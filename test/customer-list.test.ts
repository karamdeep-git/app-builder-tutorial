import axios from "axios";
import { initializeTestLogger, log } from "../actions-src/logger";
import { main } from "../actions-src/customer/list";
import { CustomerListParams } from "../actions-src/customer/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: CustomerListParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
};

function mockSearchResponse(data: unknown) {
  mockAxios.mockResolvedValue({ data });
}

function calledConfig(): { url: string; method: string; timeout?: number } {
  return (mockAxios.mock.calls as unknown as { url: string; method: string; timeout?: number }[][])[0][0];
}

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  });
}

describe("customer list action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("returns only the list columns for each customer, plus paging info", async () => {
    mockSearchResponse({
      items: [
        {
          id: 1,
          email: "roni_cost@example.com",
          firstname: "Veronica",
          lastname: "Costello",
          group_id: 1,
          website_id: 1,
          created_at: "2026-09-17 12:01:33",
          dob: "1973-12-15",
          addresses: [{ id: 1, city: "Calder" }],
        },
      ],
      total_count: 1,
    });

    const result = await main(baseParams);

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      type: "Customer list",
      response: {
        items: [
          {
            id: 1,
            name: "Veronica Costello",
            email: "roni_cost@example.com",
            groupId: 1,
            websiteId: 1,
            createdAt: "2026-09-17 12:01:33",
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      },
    });
  });

  it("calls GET /V1/customers/search newest-first with the Commerce timeout", async () => {
    mockSearchResponse({ items: [], total_count: 0 });

    await main({ ...baseParams, page: 2, pageSize: 50 });

    const config = calledConfig();
    expect(config.method).toBe("GET");
    expect(config.url).toContain("https://commerce.example.com/rest/V1/customers/search?");
    expect(config.url).toContain("searchCriteria[sortOrders][0][field]=created_at");
    expect(config.url).toContain("searchCriteria[sortOrders][0][direction]=DESC");
    expect(config.url).toContain("searchCriteria[pageSize]=50");
    expect(config.url).toContain("searchCriteria[currentPage]=2");
    expect(config.timeout).toBe(15000);
  });

  it("ORs one search term across email, first name and last name", async () => {
    mockSearchResponse({ items: [], total_count: 0 });

    await main({ ...baseParams, query: "roni" });

    const url = calledConfig().url;
    expect(url).toContain("searchCriteria[filter_groups][0][filters][0][field]=email");
    expect(url).toContain("searchCriteria[filter_groups][0][filters][1][field]=firstname");
    expect(url).toContain("searchCriteria[filter_groups][0][filters][2][field]=lastname");
    expect(url).toContain("[value]=%25roni%25");
    expect(url).toContain("[condition_type]=like");
    expect(url).not.toContain("filter_groups][1]");
  });

  it("ANDs multiple terms as separate filter groups, so a full name matches", async () => {
    mockSearchResponse({ items: [], total_count: 0 });

    await main({ ...baseParams, query: "  veronica   costello " });

    const url = calledConfig().url;
    expect(url).toContain("searchCriteria[filter_groups][0][filters][0][value]=%25veronica%25");
    expect(url).toContain("searchCriteria[filter_groups][1][filters][0][value]=%25costello%25");
  });

  it("caps the number of search terms at 5", async () => {
    mockSearchResponse({ items: [], total_count: 0 });

    await main({ ...baseParams, query: "a b c d e f g" });

    const url = calledConfig().url;
    expect(url).toContain("filter_groups][4]");
    expect(url).not.toContain("filter_groups][5]");
  });

  it("omits filter_groups for a blank query (browse all)", async () => {
    mockSearchResponse({ items: [], total_count: 0 });

    await main({ ...baseParams, query: "   " });

    expect(calledConfig().url).not.toContain("filter_groups");
  });

  it("clamps invalid page/pageSize to safe values", async () => {
    mockSearchResponse({ items: [], total_count: 0 });

    const result = await main({ ...baseParams, page: -3, pageSize: 5000 });

    expect(result.body).toMatchObject({ response: { page: 1, pageSize: 100 } });
  });

  it("rejects an over-long search query without calling Magento", async () => {
    const result = await main({ ...baseParams, query: "x".repeat(256) });

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns 502 when Magento's response has no items array", async () => {
    mockSearchResponse({ message: "something else" });

    const result = await main(baseParams);

    expect(result).toMatchObject({ statusCode: 502, body: { error: "Magento returned an unexpected response." } });
  });

  it("returns 502 (not Magento's detail) when Magento rejects the integration credentials", async () => {
    mockAxios.mockRejectedValue(httpError(401, { message: "The consumer isn't authorized to access %resources." }));

    const result = await main(baseParams);

    expect(result).toMatchObject({ statusCode: 502, body: { error: "Magento rejected this app's integration credentials." } });
  });

  it("returns 504 when Magento times out", async () => {
    mockAxios.mockRejectedValue(Object.assign(new Error("timeout of 15000ms exceeded"), { isAxiosError: true, code: "ECONNABORTED" }));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(504);
  });

  it("never writes the search term (customer PII) into error logs", async () => {
    mockAxios.mockRejectedValue(httpError(500, { message: "boom" }));

    await main({ ...baseParams, query: "pii@example.com" });

    const errorLogs = (log().error as jest.Mock).mock.calls.map((call) => String(call[0])).join("\n");
    expect(errorLogs).toContain("Customer search failed");
    expect(errorLogs).not.toContain("pii");
  });
});
