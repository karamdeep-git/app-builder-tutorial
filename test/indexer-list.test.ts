import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/indexer/list";
import { IndexerListParams } from "../actions-src/indexer/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: IndexerListParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
  COMMERCE_STORE_CODES: "[]",
};

const sampleIndexers = [
  {
    indexer_id: "catalog_product_price",
    title: "Product Price",
    status: "valid",
    scheduled: false,
    latest_updated: "2026-09-29 11:20:42",
  },
  {
    indexer_id: "catalogsearch_fulltext",
    title: "Catalog Search",
    status: "invalid",
    scheduled: true,
    latest_updated: null,
  },
];

describe("indexer list action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("returns the indexer list from Commerce", async () => {
    mockAxios.mockResolvedValue({ data: sampleIndexers });

    const result = await main(baseParams);

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("/kinex-reindex/indexers"), method: "GET" })
    );
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ type: "Indexers", response: { indexers: sampleIndexers } });
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 401"));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
