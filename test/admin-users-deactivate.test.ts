import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/admin-users/deactivate";
import { AdminUserDeactivateParams } from "../actions-src/admin-users/types/request";

jest.mock("axios");

const mockAxios = axios as unknown as jest.Mock & { isAxiosError: jest.Mock };

const baseParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
};

describe("admin-users deactivate action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
    mockAxios.isAxiosError = jest.fn().mockReturnValue(false);
  });

  it("deactivates the given admin user ids", async () => {
    mockAxios.mockResolvedValue({ data: {} });

    const params: AdminUserDeactivateParams = { ...baseParams, userIds: [2] };
    const result = await main(params);

    const call = mockAxios.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.url).toContain("/kinex-admin-users/deactivate");
    expect(call.data).toEqual({ userIds: [2] });
    expect(result.statusCode).toBe(200);
  });

  it("rejects a request with no userIds", async () => {
    const result = await main({ ...baseParams } as AdminUserDeactivateParams);

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("surfaces Magento's own 'at least one admin must remain active' message with a 400", async () => {
    mockAxios.isAxiosError = jest.fn().mockReturnValue(true);
    mockAxios.mockRejectedValue({
      response: {
        status: 400,
        data: { message: "At least one admin user must remain active. Activate another user before deactivating this one." },
      },
    });

    const result = await main({ ...baseParams, userIds: [1] });

    expect(result.statusCode).toBe(400);
    expect(result.body).toMatchObject({
      success: false,
      error: "At least one admin user must remain active. Activate another user before deactivating this one.",
    });
  });

  it("returns a 500 error for a non-Magento failure", async () => {
    mockAxios.mockRejectedValue(new Error("Network error"));

    const result = await main({ ...baseParams, userIds: [2] });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
