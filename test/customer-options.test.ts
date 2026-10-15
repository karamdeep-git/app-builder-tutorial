import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/customer/options";
import { CustomerOptionsParams } from "../actions-src/customer/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: CustomerOptionsParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
};

const MAGENTO_RESPONSES: Record<string, unknown> = {
  "/customerGroups/search": {
    items: [
      { id: 0, code: "NOT LOGGED IN" },
      { id: 3, code: "Retailer" },
      { id: 1, code: "General" },
      { id: 2, code: "Wholesale" },
    ],
  },
  "/customerGroups/default": { id: 1, code: "General" },
  "/store/websites": [
    { id: 0, code: "admin", name: "Admin" },
    { id: 1, code: "base", name: "Main Website" },
  ],
  "/store/storeViews": [
    { id: 0, code: "admin", name: "Admin", website_id: 0, is_active: 1 },
    { id: 1, code: "default", name: "Default Store View", website_id: 1, is_active: 1 },
    { id: 2, code: "old", name: "Retired View", website_id: 1, is_active: 0 },
  ],
};

function mockMagento(overrides: Record<string, unknown> = {}) {
  const responses = { ...MAGENTO_RESPONSES, ...overrides };
  mockAxios.mockImplementation(((config: { url: string }) => {
    const path = config.url.replace("https://commerce.example.com/rest/V1", "").split("?")[0];
    const response = responses[path];
    return response instanceof Error ? Promise.reject(response) : Promise.resolve({ data: response });
  }) as unknown as typeof axios);
}

describe("customer options action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("returns assignable groups (sorted), the default group, websites and active store views", async () => {
    mockMagento();

    const result = await main(baseParams);

    expect(result).toEqual({
      statusCode: 200,
      body: {
        type: "Customer options",
        response: {
          groups: [
            { id: 1, code: "General" },
            { id: 3, code: "Retailer" },
            { id: 2, code: "Wholesale" },
          ],
          defaultGroupId: 1,
          websites: [{ id: 1, code: "base", name: "Main Website" }],
          storeViews: [{ id: 1, code: "default", name: "Default Store View", websiteId: 1 }],
        },
      },
    });
  });

  it("requests the groups with a searchCriteria (Magento requires one on search endpoints)", async () => {
    mockMagento();

    await main(baseParams);

    const urls = (mockAxios.mock.calls as unknown as { url: string }[][]).map((call) => call[0].url);
    expect(urls).toContain(
      "https://commerce.example.com/rest/V1/customerGroups/search?searchCriteria[pageSize]=200&searchCriteria[currentPage]=1"
    );
  });

  it("returns defaultGroupId null if Magento's default group has no id", async () => {
    mockMagento({ "/customerGroups/default": {} });

    const result = await main(baseParams);

    expect(result.body).toMatchObject({ response: { defaultGroupId: null } });
  });

  it("returns 502 when an endpoint returns the wrong shape", async () => {
    mockMagento({ "/store/websites": { message: "not a list" } });

    const result = await main(baseParams);

    expect(result).toMatchObject({ statusCode: 502, body: { error: "Magento returned an unexpected response." } });
  });

  it("fails the whole request if any lookup fails", async () => {
    mockMagento({
      "/store/storeViews": Object.assign(new Error("Request failed with status code 403"), {
        isAxiosError: true,
        response: { status: 403, data: { message: "The consumer isn't authorized to access %resources." } },
      }),
    });

    const result = await main(baseParams);

    expect(result.statusCode).toBe(502);
  });
});
