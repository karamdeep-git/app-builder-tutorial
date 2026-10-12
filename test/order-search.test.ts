import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/order/search";
import { OrderSearchParams } from "../actions-src/order/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: OrderSearchParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
};

function mockOrdersResponse(response: { items: unknown[]; total_count: number }) {
  mockAxios.mockResolvedValue({ data: response });
}

function getCalledUrl(): string {
  const calls = mockAxios.mock.calls as unknown as { url: string }[][];
  return calls[0][0].url;
}

describe("order search action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("returns items/totalCount/page/pageSize on a successful search", async () => {
    mockOrdersResponse({
      items: [
        {
          entity_id: 1,
          increment_id: "000000001",
          customer_firstname: "Veronica",
          customer_lastname: "Costello",
          customer_email: "roni_cost@example.com",
          created_at: "2026-09-17 12:01:33",
          status: "processing",
          state: "processing",
          grand_total: 36.39,
          total_paid: 36.39,
          total_due: 0,
          order_currency_code: "USD",
        },
      ],
      total_count: 1,
    });

    const result = await main(baseParams);

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      type: "Order search",
      response: {
        items: [
          {
            id: 1,
            incrementId: "000000001",
            customerName: "Veronica Costello",
            customerEmail: "roni_cost@example.com",
            status: "processing",
            paymentStatus: "Paid",
            grandTotal: 36.39,
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      },
    });
  });

  it("labels a guest order with no name as 'Guest'", async () => {
    mockOrdersResponse({
      items: [{ entity_id: 2, increment_id: "000000002", customer_is_guest: 1, total_paid: 0, total_due: 50 }],
      total_count: 1,
    });

    const result = await main(baseParams);

    expect(result.body).toMatchObject({ response: { items: [{ customerName: "Guest", paymentStatus: "Pending" }] } });
  });

  it("derives Partially Paid and Refunded payment statuses correctly", async () => {
    mockOrdersResponse({
      items: [
        { entity_id: 3, increment_id: "3", total_paid: 10, total_due: 20 },
        { entity_id: 4, increment_id: "4", total_paid: 30, total_due: 0, total_refunded: 15 },
      ],
      total_count: 2,
    });

    const result = await main(baseParams);

    expect(result.body).toMatchObject({
      response: {
        items: [{ paymentStatus: "Partially Paid" }, { paymentStatus: "Refunded" }],
      },
    });
  });

  it("builds an OR searchCriteria over order number, email and customer name, sorted newest first", async () => {
    mockOrdersResponse({ items: [], total_count: 0 });

    await main({ ...baseParams, query: "roni", page: 2, pageSize: 10 });

    const calledUrl = getCalledUrl();
    expect(calledUrl).toContain("searchCriteria[filter_groups][0][filters][0][field]=increment_id");
    expect(calledUrl).toContain("searchCriteria[filter_groups][0][filters][1][field]=customer_email");
    expect(calledUrl).toContain("searchCriteria[filter_groups][0][filters][2][field]=customer_firstname");
    expect(calledUrl).toContain("searchCriteria[filter_groups][0][filters][3][field]=customer_lastname");
    expect(calledUrl).toContain("[value]=%25roni%25");
    expect(calledUrl).toContain("searchCriteria[sortOrders][0][field]=created_at");
    expect(calledUrl).toContain("searchCriteria[sortOrders][0][direction]=DESC");
    expect(calledUrl).toContain("searchCriteria[pageSize]=10");
    expect(calledUrl).toContain("searchCriteria[currentPage]=2");
  });

  it("adds a status eq filter_group when status is provided", async () => {
    mockOrdersResponse({ items: [], total_count: 0 });

    await main({ ...baseParams, status: "processing" });

    const calledUrl = getCalledUrl();
    expect(calledUrl).toContain("searchCriteria[filter_groups][0][filters][0][field]=status");
    expect(calledUrl).toContain("searchCriteria[filter_groups][0][filters][0][value]=processing");
    expect(calledUrl).toContain("searchCriteria[filter_groups][0][filters][0][condition_type]=eq");
  });

  it("adds gteq/lteq created_at filter_groups when a date range is provided", async () => {
    mockOrdersResponse({ items: [], total_count: 0 });

    await main({ ...baseParams, dateFrom: "2026-01-01", dateTo: "2026-01-31" });

    const calledUrl = getCalledUrl();
    expect(calledUrl).toContain("field]=created_at");
    expect(calledUrl).toContain(encodeURIComponent("2026-01-01 00:00:00"));
    expect(calledUrl).toContain("condition_type]=gteq");
    expect(calledUrl).toContain(encodeURIComponent("2026-01-31 23:59:59"));
    expect(calledUrl).toContain("condition_type]=lteq");
  });

  it("omits filter_groups entirely for a blank query with no filters (browse all)", async () => {
    mockOrdersResponse({ items: [{ entity_id: 1 }, { entity_id: 2 }], total_count: 2 });

    const result = await main({ ...baseParams, query: "   " });

    expect(getCalledUrl()).not.toContain("filter_groups");
    expect(result.body).toMatchObject({ response: { totalCount: 2 } });
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 401"));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });

  it("clamps invalid page/pageSize to safe defaults", async () => {
    mockOrdersResponse({ items: [], total_count: 0 });

    const result = await main({ ...baseParams, page: -5, pageSize: 99999 });

    expect(result.body).toMatchObject({ response: { page: 1, pageSize: 100 } });
  });
});
