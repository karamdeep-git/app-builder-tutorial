import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/category/create";
import { CategoryCreateParams } from "../actions-src/category/types/request";

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

describe("category create action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("creates a category under the given parent", async () => {
    const created = { id: 48, name: "New Category", parent_id: 2, is_active: true };
    mockAxios.mockResolvedValue({ data: created });

    const params: CategoryCreateParams = { ...baseParams, name: "New Category", parentId: 2 };
    const result = await main(params);

    const call = mockAxios.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.data).toEqual({ category: { parent_id: 2, name: "New Category", is_active: true } });
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ type: "Category created", response: { category: created } });
  });

  it("respects an explicit isActive: false", async () => {
    mockAxios.mockResolvedValue({ data: {} });

    await main({ ...baseParams, name: "Disabled Category", parentId: 2, isActive: false });

    expect(mockAxios.mock.calls[0][0].data).toEqual({
      category: { parent_id: 2, name: "Disabled Category", is_active: false },
    });
  });

  it("includes is_anchor as a custom_attribute string when explicitly set", async () => {
    mockAxios.mockResolvedValue({ data: {} });

    await main({ ...baseParams, name: "Anchor Category", parentId: 2, isAnchor: false });

    expect(mockAxios.mock.calls[0][0].data).toEqual({
      category: {
        parent_id: 2,
        name: "Anchor Category",
        is_active: true,
        custom_attributes: [{ attribute_code: "is_anchor", value: "0" }],
      },
    });
  });

  it("omits custom_attributes entirely when isAnchor isn't provided (Magento applies its own default)", async () => {
    mockAxios.mockResolvedValue({ data: {} });

    await main({ ...baseParams, name: "Default Anchor Category", parentId: 2 });

    expect(mockAxios.mock.calls[0][0].data.category.custom_attributes).toBeUndefined();
  });

  it("rejects a request with no name", async () => {
    const result = await main({ ...baseParams, name: "  ", parentId: 2 });

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("rejects a request with no parentId", async () => {
    const result = await main({ ...baseParams, name: "New Category" } as CategoryCreateParams);

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 500"));

    const result = await main({ ...baseParams, name: "New Category", parentId: 2 });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
