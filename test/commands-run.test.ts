import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/commands/run";
import { CommandsRunParams } from "../actions-src/commands/types/request";

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

describe("commands run action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("starts a job and returns its id", async () => {
    mockAxios.mockResolvedValue({ data: "job-abc-123" });

    const params: CommandsRunParams = {
      ...baseParams,
      commandIds: ["cache_flush", "cache_clean"],
      stopOnFailure: true,
      triggeredBy: "karam",
    };
    const result = await main(params);

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/kinex-commands/run"),
        method: "POST",
        data: { commandIds: ["cache_flush", "cache_clean"], stopOnFailure: true, triggeredBy: "karam" },
      })
    );
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ type: "Job started", response: { jobId: "job-abc-123" } });
  });

  it("defaults stopOnFailure to true and triggeredBy to 'unknown' when omitted", async () => {
    mockAxios.mockResolvedValue({ data: "job-xyz" });

    await main({ ...baseParams, commandIds: ["cache_flush"] } as unknown as CommandsRunParams);

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { commandIds: ["cache_flush"], stopOnFailure: true, triggeredBy: "unknown" },
      })
    );
  });

  it("rejects a request with no commandIds", async () => {
    const params: CommandsRunParams = { ...baseParams, commandIds: [], stopOnFailure: true, triggeredBy: "karam" };
    const result = await main(params);

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 500"));

    const params: CommandsRunParams = {
      ...baseParams,
      commandIds: ["cache_flush"],
      stopOnFailure: true,
      triggeredBy: "karam",
    };
    const result = await main(params);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
