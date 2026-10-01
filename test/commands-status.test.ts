import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/commands/status";
import { CommandsStatusParams } from "../actions-src/commands/types/request";

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

describe("commands status action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("parses and returns the job's current state", async () => {
    const job = { jobId: "job-abc-123", status: "running", commands: [{ id: "cache_flush", status: "running" }] };
    mockAxios.mockResolvedValue({ data: JSON.stringify(job) });

    const params: CommandsStatusParams = { ...baseParams, jobId: "job-abc-123" };
    const result = await main(params);

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("/kinex-commands/status/job-abc-123"), method: "GET" })
    );
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ type: "Job status", response: { job } });
  });

  it("rejects a request with no jobId", async () => {
    const result = await main({ ...baseParams, jobId: "" });

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 404"));

    const result = await main({ ...baseParams, jobId: "missing-job" });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
