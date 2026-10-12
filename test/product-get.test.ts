import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/product/get";
import { ProductGetParams } from "../actions-src/product/types/request";

jest.mock("axios");

const mockAxios = axios as unknown as jest.Mock;

const baseParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
};

describe("product get action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("fetches the product live from Magento, including current stock", async () => {
    const product = {
      sku: "24-MB01",
      name: "Joust Duffle Bag",
      extension_attributes: { stock_item: { item_id: 1, qty: 42, is_in_stock: true } },
    };
    mockAxios.mockResolvedValue({ data: product });

    const params: ProductGetParams = { ...baseParams, sku: "24-MB01" };
    const result = await main(params);

    const call = mockAxios.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.url).toContain("/products/24-MB01");
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ type: "Product fetched", response: { product } });
  });

  it("rejects a request with no sku", async () => {
    const result = await main({ ...baseParams } as ProductGetParams);

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 404"));

    const result = await main({ ...baseParams, sku: "missing-sku" });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
