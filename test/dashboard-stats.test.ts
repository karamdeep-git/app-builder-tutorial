import axios from "axios";
import { main, startOfTodayUtc } from "../actions-src/dashboard/stats";
import { DashboardStatsParams } from "../actions-src/dashboard/types/request";
import { initializeTestLogger } from "../actions-src/logger";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const params: DashboardStatsParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
};

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  });
}

type Responder = (url: string) => unknown;

// Routes each Magento call by URL; a value that's an Error is thrown as the failure.
function mockMagento(overrides: Partial<Record<string, Responder | unknown>> = {}) {
  const routes: Record<string, Responder | unknown> = {
    storeConfigs: [
      { id: 0, code: "admin", timezone: "UTC", base_currency_code: "USD" },
      { id: 1, code: "default", timezone: "America/Toronto", base_currency_code: "CAD" },
    ],
    ordersToday: {
      items: [
        { base_grand_total: 100.5, state: "processing" },
        { base_grand_total: 40, state: "canceled" },
        { base_grand_total: 20.25, state: "new" },
      ],
      total_count: 3,
    },
    ordersTotal: { total_count: 1284 },
    customers: { total_count: 42 },
    products: { total_count: 2044 },
    admins: [{ active: true }, { active: false }, { active: true }],
    ...overrides,
  };

  mockAxios.mockImplementation(((config: { url: string }) => {
    const url = config.url;
    const key = url.includes("/store/storeConfigs")
      ? "storeConfigs"
      : url.includes("/orders?") && url.includes("created_at")
        ? "ordersToday"
        : url.includes("/orders?")
          ? "ordersTotal"
          : url.includes("/customers/search")
            ? "customers"
            : url.includes("/products?")
              ? "products"
              : url.includes("/kinex-admin-users")
                ? "admins"
                : null;
    if (!key) return Promise.reject(new Error(`unexpected URL ${url}`));
    const route = routes[key];
    const value = typeof route === "function" ? (route as Responder)(url) : route;
    return value instanceof Error ? Promise.reject(value) : Promise.resolve({ data: value });
  }) as unknown as typeof axios);
}

function calledUrls(): string[] {
  return (mockAxios.mock.calls as unknown as { url: string }[][]).map((call) => call[0].url);
}

describe("startOfTodayUtc", () => {
  it.each([
    ["America/Toronto, evening before UTC midnight (EDT, UTC-4)", "2026-10-14T03:00:00Z", "America/Toronto", "2026-10-13 04:00:00"],
    ["America/Toronto in winter (EST, UTC-5)", "2026-01-15T12:00:00Z", "America/Toronto", "2026-01-15 05:00:00"],
    ["Asia/Kolkata (UTC+5:30) - local date is already tomorrow", "2026-10-13T20:00:00Z", "Asia/Kolkata", "2026-10-13 18:30:00"],
    ["UTC", "2026-10-14T03:00:00Z", "UTC", "2026-10-14 00:00:00"],
  ])("%s", (_label, now, timeZone, expected) => {
    expect(startOfTodayUtc(new Date(now), timeZone)).toBe(expected);
  });
});

describe("dashboard stats action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("returns every headline number, with today's sales in base currency excluding canceled orders", async () => {
    mockMagento();

    const result = await main(params);

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      type: "Dashboard stats",
      response: {
        timezone: "America/Toronto",
        currency: "CAD",
        today: { orders: 3, sales: 120.75, partial: false },
        orders: { total: 1284 },
        customers: { total: 42 },
        products: { enabled: 2044 },
        admins: { active: 2, total: 3 },
        errors: {},
      },
    });
  });

  it("asks Magento only for counts, filters enabled products, and bounds today by store-time midnight", async () => {
    mockMagento();

    await main(params);

    const urls = calledUrls();
    const ordersTotal = urls.find((u) => u.includes("/orders?") && !u.includes("created_at"))!;
    expect(ordersTotal).toContain("searchCriteria[pageSize]=1");
    expect(ordersTotal).toContain("&fields=total_count");

    const products = urls.find((u) => u.includes("/products?"))!;
    expect(products).toContain("[field]=status");
    expect(products).toContain("[value]=1");
    expect(products).toContain("[condition_type]=eq");

    const today = urls.find((u) => u.includes("created_at"))!;
    expect(today).toContain("[condition_type]=gteq");
    expect(today).toContain(encodeURIComponent("items[base_grand_total,state],total_count"));
    expect(today).toMatch(/\[value\]=\d{4}-\d{2}-\d{2}%20\d{2}%3A\d{2}%3A00/);
  });

  it("pages through a busy day and reports partial once past the cap", async () => {
    const page = Array.from({ length: 300 }, () => ({ base_grand_total: 1, state: "processing" }));
    mockMagento({ ordersToday: { items: page, total_count: 5000 } });

    const result = await main(params);

    expect(calledUrls().filter((u) => u.includes("created_at"))).toHaveLength(10);
    expect(result.body).toMatchObject({ response: { today: { orders: 5000, sales: 3000, partial: true } } });
  });

  it("stops paging once every order today is fetched", async () => {
    mockMagento({
      ordersToday: (url: string) => ({
        items: Array.from({ length: url.includes("currentPage]=3") ? 50 : 300 }, () => ({ base_grand_total: 2, state: "new" })),
        total_count: 650,
      }),
    });

    const result = await main(params);

    expect(calledUrls().filter((u) => u.includes("created_at"))).toHaveLength(3);
    expect(result.body).toMatchObject({ response: { today: { orders: 650, sales: 1300, partial: false } } });
  });

  it("keeps the other numbers when one section fails, with that section's reason", async () => {
    mockMagento({ customers: httpError(503, { message: "Service Unavailable" }) });

    const result = await main(params);

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      response: {
        customers: null,
        orders: { total: 1284 },
        errors: { customers: "Magento returned an error. Try again, or check Magento's logs." },
      },
    });
  });

  it("fails today's numbers (rather than guess UTC) when the store timezone can't be read", async () => {
    mockMagento({ storeConfigs: httpError(403, {}) });

    const result = await main(params);

    expect(result.body).toMatchObject({
      response: {
        today: null,
        timezone: null,
        products: { enabled: 2044 },
        errors: { today: "This app's Magento integration isn't allowed to perform this operation." },
      },
    });
    expect(calledUrls().some((u) => u.includes("created_at"))).toBe(false);
  });

  it("explains a missing admin-user API (Kinex_ZLF31QCAN not installed)", async () => {
    mockMagento({ admins: httpError(404, { message: "Request does not match any route." }) });

    const result = await main(params);

    expect(result.body).toMatchObject({
      response: { admins: null, errors: { admins: "Admin user API not found - is Kinex_ZLF31QCAN installed?" } },
    });
  });

  it("returns an error status only when every section fails", async () => {
    mockAxios.mockRejectedValue(Object.assign(new Error("timeout"), { isAxiosError: true, code: "ECONNABORTED" }));

    const result = await main(params);

    expect(result).toEqual({
      statusCode: 504,
      body: { success: false, error: "Magento didn't respond in time. Try again." },
    });
  });

  it("treats a count response without total_count as an unexpected response", async () => {
    mockMagento({ products: { items: [] } });

    const result = await main(params);

    expect(result.body).toMatchObject({
      response: { products: null, errors: { products: "Magento returned an unexpected response." } },
    });
  });
});
