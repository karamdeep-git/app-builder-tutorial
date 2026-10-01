import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/category/get";
import { CategoryGetParams } from "../actions-src/category/types/request";

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

describe("category get action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("extracts is_anchor out of custom_attributes as a boolean", async () => {
    mockAxios.mockResolvedValue({
      data: {
        id: 48,
        name: "Women",
        parent_id: 2,
        is_active: true,
        custom_attributes: [{ attribute_code: "is_anchor", value: "1" }],
      },
    });

    const params: CategoryGetParams = { ...baseParams, categoryId: 48 };
    const result = await main(params);

    const call = mockAxios.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.url).toContain("/categories/48");
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      type: "Category",
      response: { category: { id: 48, name: "Women", parentId: 2, isActive: true, isAnchor: true } },
    });
  });

  it("defaults isAnchor to false when the attribute is \"0\" or missing", async () => {
    mockAxios.mockResolvedValue({
      data: { id: 49, name: "No Anchor Attr", parent_id: 2, is_active: true, custom_attributes: [] },
    });

    const result = await main({ ...baseParams, categoryId: 49 });

    expect(result.body).toMatchObject({ response: { category: { isAnchor: false } } });
  });

  it("accepts a categoryId arriving as a string, as it does from GET query params", async () => {
    mockAxios.mockResolvedValue({
      data: { id: 48, name: "Women", parent_id: 2, is_active: true, custom_attributes: [] },
    });

    const result = await main({ ...baseParams, categoryId: "48" } as unknown as CategoryGetParams);

    const call = mockAxios.mock.calls[0][0];
    expect(call.url).toContain("/categories/48");
    expect(result.statusCode).toBe(200);
  });

  it("rejects a request with no categoryId", async () => {
    const result = await main({ ...baseParams } as CategoryGetParams);

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 404"));

    const result = await main({ ...baseParams, categoryId: 999 });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
