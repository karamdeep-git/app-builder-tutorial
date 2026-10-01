import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/category/update";
import { CategoryUpdateParams } from "../actions-src/category/types/request";

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

describe("category update action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("renames a category, sending only id + name", async () => {
    mockAxios.mockResolvedValue({ data: { id: 48, name: "Renamed" } });

    const params: CategoryUpdateParams = { ...baseParams, categoryId: 48, name: "Renamed" };
    const result = await main(params);

    const call = mockAxios.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.url).toContain("/categories/48");
    expect(call.data).toEqual({ category: { id: 48, name: "Renamed" } });
    expect(result.statusCode).toBe(200);
  });

  it("toggles isActive without touching name when name is omitted", async () => {
    mockAxios.mockResolvedValue({ data: {} });

    await main({ ...baseParams, categoryId: 48, isActive: false });

    expect(mockAxios.mock.calls[0][0].data).toEqual({ category: { id: 48, is_active: false } });
  });

  it("sends is_anchor as a custom_attribute string when explicitly set", async () => {
    mockAxios.mockResolvedValue({ data: {} });

    await main({ ...baseParams, categoryId: 48, isAnchor: true });

    expect(mockAxios.mock.calls[0][0].data).toEqual({
      category: { id: 48, custom_attributes: [{ attribute_code: "is_anchor", value: "1" }] },
    });
  });

  it("rejects a request with no categoryId", async () => {
    const result = await main({ ...baseParams, name: "x" } as CategoryUpdateParams);

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("rejects an empty name", async () => {
    const result = await main({ ...baseParams, categoryId: 48, name: "   " });

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 500"));

    const result = await main({ ...baseParams, categoryId: 48, name: "Renamed" });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
