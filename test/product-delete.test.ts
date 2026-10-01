import axios from "axios";
import { AdobeState } from "@adobe/aio-lib-state";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/product/delete";
import { productStateKey } from "../actions-src/product/types/product";
import { getStateClient } from "../actions-src/utils/lib-state/state-client";
import { ProductDeleteParams } from "../actions-src/product/types/request";

jest.mock("axios");
jest.mock("../actions-src/utils/lib-state/state-client");

// See product-update.test.ts for why this is a plain jest.Mock rather than
// jest.MockedFunction<typeof axios>.
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

describe("product delete action", () => {
  let mockStateClient: jest.Mocked<AdobeState>;

  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
    mockStateClient = makeMockStateClient();
    mockGetStateClient.mockResolvedValue(mockStateClient);
  });

  it("deletes the product from Commerce and from the state cache", async () => {
    mockAxios.mockResolvedValue({ data: true });
    mockStateClient.delete.mockResolvedValue(productStateKey("24-MB01"));

    const params: ProductDeleteParams = { ...commerceParams, sku: "24-MB01" };
    const result = await main(params);

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({ method: "DELETE", url: expect.stringContaining("/products/24-MB01") })
    );
    expect(mockStateClient.delete).toHaveBeenCalledWith(productStateKey("24-MB01"));
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ success: true });
  });

  it("treats a product already missing from Commerce as a successful delete", async () => {
    mockAxios.mockRejectedValue(notFoundError());
    mockStateClient.delete.mockResolvedValue(productStateKey("24-MB01"));

    const params: ProductDeleteParams = { ...commerceParams, sku: "24-MB01" };
    const result = await main(params);

    expect(mockStateClient.delete).toHaveBeenCalledWith(productStateKey("24-MB01"));
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ success: true });
  });

  it("returns a 500 error when Commerce rejects the delete for a non-404 reason", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 401"));

    const params: ProductDeleteParams = { ...commerceParams, sku: "24-MB01" };
    const result = await main(params);

    expect(result.statusCode).toBe(500);
    expect(mockStateClient.delete).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the state delete fails after a successful Commerce delete", async () => {
    mockAxios.mockResolvedValue({ data: true });
    mockStateClient.delete.mockRejectedValue(new Error("state unavailable"));

    const params: ProductDeleteParams = { ...commerceParams, sku: "24-MB01" };
    const result = await main(params);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
