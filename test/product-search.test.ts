import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/product/search";
import { ProductSearchParams } from "../actions-src/product/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: ProductSearchParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
  COMMERCE_STORE_CODES: "[]",
  query: "24-MB01",
};

describe("product search action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("returns items/totalCount/page/pageSize on a successful search", async () => {
    mockAxios.mockResolvedValue({
      data: { items: [{ sku: "24-MB01", name: "Joust Duffle Bag", price: 34 }], total_count: 1 },
    });

    const result = await main(baseParams);

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      type: "Product search",
      response: {
        items: [{ sku: "24-MB01", name: "Joust Duffle Bag", price: 34 }],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      },
    });
  });

  it("builds an OR searchCriteria over sku and name with unencoded bracket keys, and passes pagination through", async () => {
    mockAxios.mockResolvedValue({ data: { items: [], total_count: 0 } });

    await main({ ...baseParams, query: "bag", page: 2, pageSize: 10 });

    const calledUrl = (mockAxios.mock.calls[0][0] as unknown as { url: string }).url;
    expect(calledUrl).toContain("searchCriteria[filter_groups][0][filters][0][field]=sku");
    expect(calledUrl).toContain("searchCriteria[filter_groups][0][filters][1][field]=name");
    expect(calledUrl).toContain("[value]=%25bag%25");
    expect(calledUrl).toContain("searchCriteria[pageSize]=10");
    expect(calledUrl).toContain("searchCriteria[currentPage]=2");
  });

  it("returns an empty items array and zero totalCount when Commerce finds no matches", async () => {
    mockAxios.mockResolvedValue({ data: { items: [], total_count: 0 } });

    const result = await main(baseParams);

    expect(result.body).toMatchObject({ response: { items: [], totalCount: 0 } });
  });

  it("returns a 400 when query is missing or blank", async () => {
    const result = await main({ ...baseParams, query: "   " });

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 401"));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });

  it("clamps invalid page/pageSize to safe defaults", async () => {
    mockAxios.mockResolvedValue({ data: { items: [], total_count: 0 } });

    const result = await main({ ...baseParams, page: -5, pageSize: 99999 });

    expect(result.body).toMatchObject({ response: { page: 1, pageSize: 100 } });
  });
});
