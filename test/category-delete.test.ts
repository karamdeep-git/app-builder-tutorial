import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/category/delete";
import { CategoryDeleteParams } from "../actions-src/category/types/request";

jest.mock("axios");

const mockAxios = axios as unknown as jest.Mock;

const baseParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
  COMMERCE_STORE_CODES: "[]",
};

describe("category delete action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("deletes the given category", async () => {
    mockAxios.mockResolvedValue({ data: true });

    const params: CategoryDeleteParams = { ...baseParams, categoryId: 48 };
    const result = await main(params);

    const call = mockAxios.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.url).toContain("/categories/48");
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ success: true });
  });

  it("rejects a request with no categoryId", async () => {
    const result = await main({ ...baseParams } as CategoryDeleteParams);

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns a 500 error when Magento rejects the delete (e.g. the protected root)", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 400"));

    const result = await main({ ...baseParams, categoryId: 2 });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
