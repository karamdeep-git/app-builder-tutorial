import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/storefront/stock";
import { StorefrontStockParams } from "../actions-src/storefront/types/request";

jest.mock("axios");

const mockAxios = axios as unknown as jest.Mock & { get: jest.Mock };

const baseParams: StorefrontStockParams = {
  sku: "WH-123",
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
};

const magentoConfig = {
  external_stock_api_url: "https://erp.example.com/api",
  external_stock_api_key: "secret-key",
  allowed_origin: "https://www.yourstore.com",
};

describe("storefront stock action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("reads config from Magento, fetches stock from the external API, and echoes the matching origin", async () => {
    mockAxios.mockResolvedValue({ data: magentoConfig });
    mockAxios.get = jest.fn().mockResolvedValue({ data: { quantity: 5, inStock: true } });

    const params = { ...baseParams, __ow_headers: { origin: "https://www.yourstore.com" } };
    const result = await main(params);

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("/kinex-storefront-stock/config") })
    );
    expect(mockAxios.get).toHaveBeenCalledWith(
      "https://erp.example.com/api/stock/WH-123",
      expect.objectContaining({ headers: { Authorization: "Bearer secret-key" }, signal: expect.any(AbortSignal) })
    );
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      type: "Stock",
      response: { sku: "WH-123", quantity: 5, inStock: true },
    });
    expect(result.headers).toEqual(
      expect.objectContaining({ "Access-Control-Allow-Origin": "https://www.yourstore.com" })
    );
  });

  it("omits Access-Control-Allow-Origin when the request origin doesn't match Magento's configured origin", async () => {
    mockAxios.mockResolvedValue({ data: magentoConfig });
    mockAxios.get = jest.fn().mockResolvedValue({ data: { quantity: 5, inStock: true } });

    const params = { ...baseParams, __ow_headers: { origin: "https://evil.example.com" } };
    const result = await main(params);

    expect(result.headers).not.toHaveProperty("Access-Control-Allow-Origin");
  });

  it("answers a CORS preflight OPTIONS request without calling the external API", async () => {
    mockAxios.mockResolvedValue({ data: magentoConfig });

    const params = { ...baseParams, __ow_method: "OPTIONS", __ow_headers: { origin: "https://www.yourstore.com" } };
    const result = await main(params);

    expect(mockAxios.get).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
    expect(result.headers).toEqual(
      expect.objectContaining({ "Access-Control-Allow-Origin": "https://www.yourstore.com" })
    );
  });

  it("rejects a request with no sku", async () => {
    mockAxios.mockResolvedValue({ data: magentoConfig });

    const { sku: _sku, ...rest } = baseParams;
    const result = await main(rest as StorefrontStockParams);

    expect(result.statusCode).toBe(400);
    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  it("returns a generic 502 when Magento's config lookup fails, with no CORS header and no Magento detail", async () => {
    mockAxios.mockRejectedValue(
      Object.assign(new Error("Request failed with status code 401"), {
        response: { status: 401, data: { message: "The consumer isn't authorized" } },
      })
    );

    const result = await main({ ...baseParams, __ow_headers: { origin: "https://www.yourstore.com" } });

    expect(result).toEqual({ statusCode: 502, body: { success: false, error: "Stock information is unavailable" } });
  });

  it("returns a generic 502 when the external stock API fails, never echoing upstream error text to shoppers", async () => {
    mockAxios.mockResolvedValue({ data: magentoConfig });
    mockAxios.get = jest
      .fn()
      .mockRejectedValue(new Error("getaddrinfo ENOTFOUND erp.internal.yourstore.com"));

    const result = await main({ ...baseParams, __ow_headers: { origin: "https://www.yourstore.com" } });

    expect(result.statusCode).toBe(502);
    expect(result.body).toEqual({ success: false, error: "Stock information is unavailable" });
    expect(JSON.stringify(result.body)).not.toContain("erp.internal");
    expect(result.headers).toBeDefined();
  });

  it("returns 504 when the external stock API times out", async () => {
    mockAxios.mockResolvedValue({ data: magentoConfig });
    mockAxios.get = jest.fn().mockRejectedValue(Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }));

    const result = await main({ ...baseParams, __ow_headers: { origin: "https://www.yourstore.com" } });

    expect(result.statusCode).toBe(504);
  });
});
