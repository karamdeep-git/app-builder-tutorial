import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/admin-users/list";
import { AdminUserListParams } from "../actions-src/admin-users/types/request";

jest.mock("axios");

const mockAxios = axios as unknown as jest.Mock;

const baseParams: AdminUserListParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
};

describe("admin-users list action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("maps Magento's admin user status rows to the frontend shape", async () => {
    mockAxios.mockResolvedValue({
      data: [
        { user_id: 1, username: "karam", email: "karam@example.com", firstname: "Karam", lastname: "Deep", active: true },
        { user_id: 2, username: "jane", email: "jane@example.com", firstname: "Jane", lastname: "Doe", active: false },
      ],
    });

    const result = await main(baseParams);

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      type: "Admin users",
      response: {
        users: [
          { id: 1, username: "karam", email: "karam@example.com", firstname: "Karam", lastname: "Deep", isActive: true },
          { id: 2, username: "jane", email: "jane@example.com", firstname: "Jane", lastname: "Doe", isActive: false },
        ],
      },
    });
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 500"));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
