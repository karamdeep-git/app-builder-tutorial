import axios from "axios";
import { AdobeState } from "@adobe/aio-lib-state";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/product/update";
import { PRODUCT_STATE_TTL_SECONDS, productStateKey } from "../actions-src/product/types/product";
import { getStateClient } from "../actions-src/utils/lib-state/state-client";
import { login, setProductStatusAllStores } from "../actions-src/utils/adobe-commerce/admin-session-client";
import { ProductUpdateParams } from "../actions-src/product/types/request";

jest.mock("axios");
jest.mock("../actions-src/utils/lib-state/state-client");
jest.mock("../actions-src/utils/adobe-commerce/admin-session-client");

const mockLogin = login as jest.MockedFunction<typeof login>;
const mockSetProductStatusAllStores = setProductStatusAllStores as jest.MockedFunction<typeof setProductStatusAllStores>;

// axios's real call shape at runtime is a single config object
// (see adobe-commerce-client.ts's apiCall), but its type declarations expose
// an overload set that makes jest.MockedFunction<typeof axios> infer the
// (url: string, config) shape instead - a plain jest.Mock sidesteps that.
const mockAxios = axios as unknown as jest.Mock;
const mockGetStateClient = getStateClient as jest.MockedFunction<typeof getStateClient>;

function makeMockStateClient(): jest.Mocked<AdobeState> {
  return {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    deleteAll: jest.fn(),
    any: jest.fn(),
    stats: jest.fn(),
    list: jest.fn(),
    getRegionalEndpoint: jest.fn(),
  } as unknown as jest.Mocked<AdobeState>;
}

const commerceParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
  COMMERCE_STORE_CODES: "[]",
};

function notFoundError() {
  return Object.assign(new Error("Request failed with status code 404"), { response: { status: 404 } });
}

describe("product update action", () => {
  let mockStateClient: jest.Mocked<AdobeState>;

  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
    mockStateClient = makeMockStateClient();
    mockGetStateClient.mockResolvedValue(mockStateClient);
  });

  it("updates an existing Commerce product and refreshes the cache from its response", async () => {
    const product = { sku: "24-MB01", name: "Joust Duffle Bag", price: 34 };
    mockAxios.mockImplementation((config) => {
      if (config.method === "GET") return Promise.resolve({ data: product });
      if (config.method === "PUT") return Promise.resolve({ data: product });
      return Promise.reject(new Error(`unexpected method ${config.method}`));
    });
    mockStateClient.put.mockResolvedValue(productStateKey(product.sku));

    const params: ProductUpdateParams = { ...commerceParams, data: product };
    const result = await main(params);

    const putCall = mockAxios.mock.calls.find((call) => call[0].method === "PUT");
    expect(putCall?.[0].data).toEqual({ product });
    expect(mockStateClient.put).toHaveBeenCalledWith(productStateKey(product.sku), JSON.stringify(product), {
      ttl: PRODUCT_STATE_TTL_SECONDS,
    });
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ success: true, message: "Product updated" });
  });

  it("creates a new Commerce product with a default attribute set when it doesn't exist yet", async () => {
    const newProduct = { sku: "new-sku", name: "New Product", price: 12 };
    const attributeSets = { items: [{ attribute_set_id: 4, attribute_set_name: "Default" }] };
    const created = { ...newProduct, attribute_set_id: 4, type_id: "simple", status: 1, visibility: 4 };

    mockAxios.mockImplementation((config) => {
      if (config.method === "GET" && config.url?.includes("/attribute-sets/")) {
        return Promise.resolve({ data: attributeSets });
      }
      if (config.method === "GET") return Promise.reject(notFoundError());
      if (config.method === "PUT") return Promise.resolve({ data: created });
      return Promise.reject(new Error(`unexpected method ${config.method}`));
    });
    mockStateClient.put.mockResolvedValue(productStateKey(newProduct.sku));

    const params: ProductUpdateParams = { ...commerceParams, data: newProduct };
    const result = await main(params);

    const putCall = mockAxios.mock.calls.find((call) => call[0].method === "PUT");
    expect(putCall?.[0].data).toMatchObject({ product: { ...newProduct, attribute_set_id: 4 } });
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ success: true, message: "Product created" });
  });

  it("rejects a product with no sku", async () => {
    const params: ProductUpdateParams = { ...commerceParams, data: { sku: "" } };
    const result = await main(params);

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
    expect(mockStateClient.put).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 401"));

    const params: ProductUpdateParams = { ...commerceParams, data: { sku: "24-MB01" } };
    const result = await main(params);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });

  it("returns a 500 error when the state write fails after a successful Commerce save", async () => {
    const product = { sku: "24-MB01", name: "Joust Duffle Bag", price: 34 };
    mockAxios.mockImplementation((config) => {
      if (config.method === "GET") return Promise.resolve({ data: product });
      if (config.method === "PUT") return Promise.resolve({ data: product });
      return Promise.reject(new Error(`unexpected method ${config.method}`));
    });
    mockStateClient.put.mockRejectedValue(new Error("state unavailable"));

    const params: ProductUpdateParams = { ...commerceParams, data: product };
    const result = await main(params);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });

  describe("category removal", () => {
    // Magento's PUT silently ignores an empty category_ids value (treated as
    // "unset", not "clear all"), so removals must go through the dedicated
    // unlink endpoint rather than relying on the custom_attributes merge.

    it("unlinks categories dropped from the selection, even down to zero", async () => {
      const existing = {
        sku: "24-MB01",
        name: "Joust Duffle Bag",
        custom_attributes: [{ attribute_code: "category_ids", value: ["26", "27"] }],
      };
      // PUT response still reflects the OLD categories - Magento hasn't
      // processed the removal yet, since that happens via separate DELETEs.
      const putResponse = { ...existing };
      const deleteCalls: string[] = [];

      mockAxios.mockImplementation((config) => {
        if (config.method === "GET") return Promise.resolve({ data: existing });
        if (config.method === "PUT") return Promise.resolve({ data: putResponse });
        if (config.method === "DELETE") {
          deleteCalls.push(config.url);
          return Promise.resolve({ data: true });
        }
        return Promise.reject(new Error(`unexpected method ${config.method}`));
      });
      mockStateClient.put.mockResolvedValue(productStateKey("24-MB01"));

      const updatedProduct = {
        sku: "24-MB01",
        name: "Joust Duffle Bag",
        custom_attributes: [{ attribute_code: "category_ids", value: [] }],
      };
      const params: ProductUpdateParams = { ...commerceParams, data: updatedProduct };
      const result = await main(params);

      expect(deleteCalls).toEqual(
        expect.arrayContaining([expect.stringContaining("/categories/26/products/24-MB01"), expect.stringContaining("/categories/27/products/24-MB01")])
      );
      expect(deleteCalls).toHaveLength(2);

      // The cache must reflect the corrected (empty) list, not the PUT
      // response's stale category_ids.
      const cachedValue = JSON.parse(mockStateClient.put.mock.calls[0][1]);
      expect(cachedValue.custom_attributes).toContainEqual({ attribute_code: "category_ids", value: [] });
      expect(result.statusCode).toBe(200);
    });

    it("only unlinks the categories actually removed, keeping the rest", async () => {
      const existing = {
        sku: "24-MB01",
        custom_attributes: [{ attribute_code: "category_ids", value: ["26", "27", "29"] }],
      };
      const deleteCalls: string[] = [];

      mockAxios.mockImplementation((config) => {
        if (config.method === "GET") return Promise.resolve({ data: existing });
        if (config.method === "PUT") return Promise.resolve({ data: existing });
        if (config.method === "DELETE") {
          deleteCalls.push(config.url);
          return Promise.resolve({ data: true });
        }
        return Promise.reject(new Error(`unexpected method ${config.method}`));
      });
      mockStateClient.put.mockResolvedValue(productStateKey("24-MB01"));

      const updatedProduct = {
        sku: "24-MB01",
        custom_attributes: [{ attribute_code: "category_ids", value: ["26", "27"] }],
      };
      await main({ ...commerceParams, data: updatedProduct });

      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0]).toContain("/categories/29/products/24-MB01");
    });

    it("does not attempt category removal when the update has no custom_attributes at all", async () => {
      const existing = {
        sku: "24-MB01",
        custom_attributes: [{ attribute_code: "category_ids", value: ["26"] }],
      };

      mockAxios.mockImplementation((config) => {
        if (config.method === "GET") return Promise.resolve({ data: existing });
        if (config.method === "PUT") return Promise.resolve({ data: existing });
        return Promise.reject(new Error(`unexpected DELETE - should not happen`));
      });
      mockStateClient.put.mockResolvedValue(productStateKey("24-MB01"));

      await main({ ...commerceParams, data: { sku: "24-MB01", price: 40 } });

      expect(mockAxios.mock.calls.some((call) => call[0].method === "DELETE")).toBe(false);
    });
  });

  describe("all-store-views status sync", () => {
    const adminParams = {
      ...commerceParams,
      COMMERCE_ADMIN_USERNAME: "admin",
      COMMERCE_ADMIN_PASSWORD: "admin-password",
    };
    const fakeSession = { cookie: "PHPSESSID=abc", formKey: "form-key" };

    function mockProductRoundtrip(existing: Record<string, unknown> | null, saved: Record<string, unknown>) {
      mockAxios.mockImplementation((config) => {
        if (config.method === "GET") {
          return existing ? Promise.resolve({ data: existing }) : Promise.reject(notFoundError());
        }
        if (config.method === "PUT") return Promise.resolve({ data: saved });
        return Promise.reject(new Error(`unexpected method ${config.method}`));
      });
    }

    it("syncs the new status to All Store Views when status changes", async () => {
      const existing = { sku: "24-MB01", id: 2047, status: 1 };
      const saved = { sku: "24-MB01", id: 2047, status: 2 };
      mockProductRoundtrip(existing, saved);
      mockStateClient.put.mockResolvedValue(productStateKey("24-MB01"));
      mockLogin.mockResolvedValue(fakeSession);
      mockSetProductStatusAllStores.mockResolvedValue(undefined);

      const params: ProductUpdateParams = { ...adminParams, data: { sku: "24-MB01", status: 2 } };
      const result = await main(params);

      expect(mockLogin).toHaveBeenCalledWith(adminParams.COMMERCE_BASE_URL, "admin", "admin-password");
      expect(mockSetProductStatusAllStores).toHaveBeenCalledWith(adminParams.COMMERCE_BASE_URL, fakeSession, 2047, 2);
      expect(result.statusCode).toBe(200);
    });

    it("does not sync when status is unchanged", async () => {
      const existing = { sku: "24-MB01", id: 2047, status: 1 };
      const saved = { sku: "24-MB01", id: 2047, status: 1, price: 50 };
      mockProductRoundtrip(existing, saved);
      mockStateClient.put.mockResolvedValue(productStateKey("24-MB01"));

      await main({ ...adminParams, data: { sku: "24-MB01", status: 1, price: 50 } });

      expect(mockLogin).not.toHaveBeenCalled();
      expect(mockSetProductStatusAllStores).not.toHaveBeenCalled();
    });

    it("does not sync when admin credentials are not configured", async () => {
      const existing = { sku: "24-MB01", id: 2047, status: 1 };
      const saved = { sku: "24-MB01", id: 2047, status: 2 };
      mockProductRoundtrip(existing, saved);
      mockStateClient.put.mockResolvedValue(productStateKey("24-MB01"));

      await main({ ...commerceParams, data: { sku: "24-MB01", status: 2 } });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it("still returns success when the sync step fails", async () => {
      const existing = { sku: "24-MB01", id: 2047, status: 1 };
      const saved = { sku: "24-MB01", id: 2047, status: 2 };
      mockProductRoundtrip(existing, saved);
      mockStateClient.put.mockResolvedValue(productStateKey("24-MB01"));
      mockLogin.mockRejectedValue(new Error("Magento admin login failed"));

      const result = await main({ ...adminParams, data: { sku: "24-MB01", status: 2 } });

      expect(result.statusCode).toBe(200);
      expect(result.body).toMatchObject({ success: true });
    });
  });
});
