import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/auth/login";
import { AdminLoginParams } from "../actions-src/auth/types/request";

jest.mock("axios");

// axios's real call shape at runtime is a single config object, but its type
// declarations expose an overload set that makes jest.MockedFunction<typeof axios>
// infer the (url: string, config) shape instead - a plain jest.Mock sidesteps that.
const mockAxios = axios as unknown as jest.Mock;

const baseParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
};

function unauthorizedError() {
  return Object.assign(new Error("Request failed with status code 401"), { response: { status: 401 } });
}

describe("auth login action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("returns the admin token on successful login", async () => {
    mockAxios.mockResolvedValue({ data: "abc123token" });

    const params: AdminLoginParams = { ...baseParams, data: { username: "admin", password: "Admin123" } };
    const result = await main(params);

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://commerce.example.com/rest/V1/integration/admin/token",
        method: "POST",
        data: { username: "admin", password: "Admin123" },
      })
    );
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      type: "Login successful",
      response: { username: "admin", token: "abc123token" },
    });
  });

  it("returns a 401 when Magento rejects the credentials", async () => {
    mockAxios.mockRejectedValue(unauthorizedError());

    const params: AdminLoginParams = { ...baseParams, data: { username: "admin", password: "wrong" } };
    const result = await main(params);

    expect(result.statusCode).toBe(401);
    expect(result.body).toMatchObject({ success: false, error: "Invalid username or password" });
  });

  it("rejects a request missing username or password", async () => {
    const params: AdminLoginParams = { ...baseParams, data: { username: "", password: "" } };
    const result = await main(params);

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce API call fails unexpectedly", async () => {
    mockAxios.mockRejectedValue(new Error("Network error"));

    const params: AdminLoginParams = { ...baseParams, data: { username: "admin", password: "Admin123" } };
    const result = await main(params);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
