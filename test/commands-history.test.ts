import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/commands/history";
import { CommandsHistoryParams } from "../actions-src/commands/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: CommandsHistoryParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
  COMMERCE_STORE_CODES: "[]",
};

describe("commands history action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("parses and returns the job history", async () => {
    const jobs = [
      { jobId: "job-2", status: "success" },
      { jobId: "job-1", status: "failed" },
    ];
    mockAxios.mockResolvedValue({ data: JSON.stringify(jobs) });

    const result = await main(baseParams);

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("/kinex-commands/history"), method: "GET" })
    );
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ type: "History", response: { jobs } });
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 500"));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
