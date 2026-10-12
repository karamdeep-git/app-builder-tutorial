import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/admin-users/activate";
import { AdminUserActivateParams } from "../actions-src/admin-users/types/request";

jest.mock("axios");

const mockAxios = axios as unknown as jest.Mock & { isAxiosError: jest.Mock };

const baseParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
};

describe("admin-users activate action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
    mockAxios.isAxiosError = jest.fn().mockReturnValue(false);
  });

  it("activates the given admin user ids", async () => {
    mockAxios.mockResolvedValue({ data: {} });

    const params: AdminUserActivateParams = { ...baseParams, userIds: [2, 3] };
    const result = await main(params);

    const call = mockAxios.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.url).toContain("/kinex-admin-users/activate");
    expect(call.data).toEqual({ userIds: [2, 3] });
    expect(result.statusCode).toBe(200);
  });

  it("rejects a request with no userIds", async () => {
    const result = await main({ ...baseParams } as AdminUserActivateParams);

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("rejects a request with an empty userIds array", async () => {
    const result = await main({ ...baseParams, userIds: [] });

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 500"));

    const result = await main({ ...baseParams, userIds: [2] });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
