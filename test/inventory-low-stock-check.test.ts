import { AdobeState } from "@adobe/aio-lib-state";
import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/inventory/low-stock-check";
import { LowStockCheckParams } from "../actions-src/inventory/types/request";
import { AppNotification, NOTIFICATIONS_INDEX_KEY } from "../actions-src/notifications/types/notification";
import { getStateClient } from "../actions-src/utils/lib-state/state-client";

jest.mock("axios");
jest.mock("../actions-src/utils/lib-state/state-client");

const mockAxios = axios as jest.MockedFunction<typeof axios>;
const mockGetStateClient = getStateClient as jest.MockedFunction<typeof getStateClient>;

const params: LowStockCheckParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
  LOW_STOCK_THRESHOLD: 5,
};

const CATALOG = [
  { id: 1, sku: "MB01", name: "Joust Duffle Bag", type_id: "simple", status: 1 },
  { id: 2, sku: "MB02", name: "Strive Shoulder Pack", type_id: "simple", status: 1 },
  { id: 3, sku: "MH01", name: "Chaz Hoodie", type_id: "configurable", status: 1 },
  { id: 4, sku: "OLD1", name: "Retired Bag", type_id: "simple", status: 2 },
  { id: 5, sku: "WRAP", name: "Gift Wrap", type_id: "virtual", status: 1 },
];

function stockItem(productId: number, qty: number, manageStock: boolean = true) {
  return { product_id: productId, qty, manage_stock: manageStock };
}

// In-memory stand-in for lib-state, so consecutive runs see each other's writes.
let store: Map<string, string>;
let stateClient: { get: jest.Mock; put: jest.Mock };

function mockMagento(lowStockItems: unknown[], options: { lowStockResponse?: unknown; catalog?: unknown[] } = {}) {
  mockAxios.mockImplementation(((config: { url: string }) => {
    if (config.url.includes("/V1/stockItems/lowStock")) {
      return Promise.resolve({ data: options.lowStockResponse ?? { items: lowStockItems, total_count: lowStockItems.length } });
    }
    if (config.url.includes("/V1/products?")) {
      return Promise.resolve({ data: { items: options.catalog ?? CATALOG } });
    }
    return Promise.reject(new Error(`unexpected URL ${config.url}`));
  }) as unknown as typeof axios);
}

function calledUrls(): string[] {
  return (mockAxios.mock.calls as unknown as { url: string }[][]).map((call) => call[0].url);
}

function savedNotifications(): AppNotification[] {
  return JSON.parse(store.get(NOTIFICATIONS_INDEX_KEY) ?? "[]");
}

describe("inventory low-stock-check action (scheduled, web: no)", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
    store = new Map();
    stateClient = {
      get: jest.fn(async (key: string) => (store.has(key) ? { value: store.get(key) } : undefined)),
      put: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
        return key;
      }),
    };
    mockGetStateClient.mockResolvedValue(stateClient as unknown as AdobeState);
  });

  it("posts one low_stock notification, skipping configurable parents, disabled and untracked products", async () => {
    mockMagento([stockItem(1, 2), stockItem(2, 0), stockItem(3, 0), stockItem(4, 1), stockItem(5, 3, false)]);

    const result = await main(params);

    const notifications = savedNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "low_stock",
      totalCount: 2,
      threshold: 5,
      read: false,
      products: [
        { sku: "MB01", name: "Joust Duffle Bag", qty: 2 },
        { sku: "MB02", name: "Strive Shoulder Pack", qty: 0 },
      ],
    });
    expect(result).toMatchObject({
      statusCode: 200,
      body: { response: { lowStockCount: 2, newlyLowCount: 2, notified: true, newlyLowSkus: ["MB01", "MB02"] } },
    });
  });

  it("asks Magento's default low-stock endpoint with the threshold, then looks up only tracked products", async () => {
    mockMagento([stockItem(1, 2), stockItem(3, 0), stockItem(5, 3, false)]);

    await main(params);

    const [lowStockUrl, productsUrl] = calledUrls();
    expect(lowStockUrl).toBe(
      "https://commerce.example.com/rest/V1/stockItems/lowStock?scopeId=0&qty=5&currentPage=1&pageSize=200"
    );
    expect(productsUrl).toContain("https://commerce.example.com/rest/V1/products?");
    expect(productsUrl).toContain("[field]=entity_id");
    expect(productsUrl).toContain("[value]=1%2C3");
    expect(productsUrl).toContain("[condition_type]=in");
  });

  it("does not alert again on the next run while the same products stay low", async () => {
    mockMagento([stockItem(1, 2)]);

    await main(params);
    const second = await main(params);

    expect(savedNotifications()).toHaveLength(1);
    expect(second.body).toMatchObject({ response: { lowStockCount: 1, newlyLowCount: 0, notified: false } });
  });

  it("alerts only about the product that newly dropped low", async () => {
    mockMagento([stockItem(1, 2)]);
    await main(params);

    mockMagento([stockItem(1, 2), stockItem(2, 1)]);
    await main(params);

    const notifications = savedNotifications();
    expect(notifications).toHaveLength(2);
    expect(notifications[0]).toMatchObject({ totalCount: 1, products: [{ sku: "MB02", qty: 1 }] });
  });

  it("alerts again after a product is restocked and later drops low again", async () => {
    const now = jest.spyOn(Date, "now");
    const start = Date.parse("2026-10-13T10:00:00Z");

    now.mockReturnValue(start);
    mockMagento([stockItem(1, 2)]);
    await main(params);

    now.mockReturnValue(start + 60 * 60 * 1000);
    mockMagento([]);
    const restocked = await main(params);
    expect(restocked.body).toMatchObject({ response: { lowStockCount: 0, notified: false } });

    now.mockReturnValue(start + 2 * 60 * 60 * 1000);
    mockMagento([stockItem(1, 1)]);
    await main(params);

    const notifications = savedNotifications();
    expect(notifications).toHaveLength(2);
    expect(notifications[0]).toMatchObject({ products: [{ sku: "MB01", qty: 1 }] });
    now.mockRestore();
  });

  it("posts once when two runs overlap (a manual run while the schedule fires)", async () => {
    mockMagento([stockItem(1, 2), stockItem(2, 0)]);

    await Promise.all([main(params), main(params)]);

    expect(savedNotifications()).toHaveLength(1);
  });

  it("skips an identical alert an overlapping run posted moments ago, even if it hadn't saved its alerted list yet", async () => {
    mockMagento([stockItem(1, 2)]);
    await main(params);
    // What the second of two overlapping runs sees: the first run's
    // notification is already there, but its alerted list isn't yet.
    store.delete("low-stock-alerted");

    const second = await main(params);

    expect(savedNotifications()).toHaveLength(1);
    expect(second.body).toMatchObject({ response: { newlyLowCount: 1, notified: false } });
  });

  it("posts nothing and skips the product lookup when nothing is low", async () => {
    mockMagento([]);

    const result = await main(params);

    expect(calledUrls()).toHaveLength(1);
    expect(store.has(NOTIFICATIONS_INDEX_KEY)).toBe(false);
    expect(result.body).toMatchObject({ response: { lowStockCount: 0, notified: false } });
  });

  it("keeps existing order notifications and puts the new alert first", async () => {
    const existingOrder = { id: "order-000000007", type: "order", incrementId: "000000007", read: true };
    store.set(NOTIFICATIONS_INDEX_KEY, JSON.stringify([existingOrder]));
    mockMagento([stockItem(1, 2)]);

    await main(params);

    const notifications = savedNotifications();
    expect(notifications.map((n) => n.type)).toEqual(["low_stock", "order"]);
    expect(notifications[1]).toEqual(existingOrder);
  });

  it("lists at most 10 products in one notification but reports the real total", async () => {
    const catalog = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, sku: `SKU${i}`, name: `P${i}`, type_id: "simple", status: 1 }));
    mockMagento(
      catalog.map((product) => stockItem(product.id, 1)),
      { catalog }
    );

    await main(params);

    expect(savedNotifications()[0]).toMatchObject({ totalCount: 12 });
    expect((savedNotifications()[0] as { products: unknown[] }).products).toHaveLength(10);
  });

  it.each([
    ["missing", undefined, "qty=5"],
    ["non-numeric", "abc", "qty=5"],
    ["negative", -1, "qty=5"],
    ["a numeric string", "12", "qty=12"],
  ])("handles a %s threshold input", async (_label, threshold, expectedQuery) => {
    mockMagento([]);

    await main({ ...params, LOW_STOCK_THRESHOLD: threshold as number | string | undefined });

    expect(calledUrls()[0]).toContain(expectedQuery);
  });

  it("returns 502 and posts nothing when Magento's response has no items array", async () => {
    mockMagento([], { lowStockResponse: { message: "unexpected" } });

    const result = await main(params);

    expect(result.statusCode).toBe(502);
    expect(stateClient.put).not.toHaveBeenCalled();
  });

  it("returns 504 and posts nothing when Magento times out", async () => {
    mockAxios.mockRejectedValue(Object.assign(new Error("timeout"), { isAxiosError: true, code: "ECONNABORTED" }));

    const result = await main(params);

    expect(result.statusCode).toBe(504);
    expect(stateClient.put).not.toHaveBeenCalled();
  });
});
