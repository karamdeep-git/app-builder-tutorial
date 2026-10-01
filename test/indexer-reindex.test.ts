import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main as reindex } from "../actions-src/indexer/reindex";
import { main as reindexStatus } from "../actions-src/indexer/reindex-status";
import { IndexerReindexParams, IndexerReindexStatusParams } from "../actions-src/indexer/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
  COMMERCE_STORE_CODES: "[]",
};

describe("indexer reindex action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("starts a job for the given indexer ids and returns its id", async () => {
    mockAxios.mockResolvedValue({ data: "job-abc-123" });

    const params: IndexerReindexParams = { ...baseParams, indexerIds: ["catalog_product_price"] };
    const result = await reindex(params);

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/kinex-reindex/jobs"),
        method: "POST",
        data: { indexerIds: ["catalog_product_price"] },
      })
    );
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ type: "Job started", response: { jobId: "job-abc-123" } });
  });

  it("defaults to an empty indexerIds array (reindex all) when omitted", async () => {
    mockAxios.mockResolvedValue({ data: "job-all" });

    await reindex({ ...baseParams } as IndexerReindexParams);

    expect(mockAxios).toHaveBeenCalledWith(expect.objectContaining({ data: { indexerIds: [] } }));
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 500"));

    const result = await reindex({ ...baseParams, indexerIds: ["catalog_product_price"] });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});

describe("indexer reindex-status action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("parses and returns the job's current state", async () => {
    const job = {
      jobId: "job-abc-123",
      status: "running",
      indexers: [{ id: "catalog_product_price", status: "running" }],
    };
    mockAxios.mockResolvedValue({ data: JSON.stringify(job) });

    const params: IndexerReindexStatusParams = { ...baseParams, jobId: "job-abc-123" };
    const result = await reindexStatus(params);

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("/kinex-reindex/jobs/job-abc-123"), method: "GET" })
    );
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ type: "Job status", response: { job } });
  });

  it("rejects a request with no jobId", async () => {
    const result = await reindexStatus({ ...baseParams, jobId: "" });

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 404"));

    const result = await reindexStatus({ ...baseParams, jobId: "missing-job" });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
