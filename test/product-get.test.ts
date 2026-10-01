import { AdobeState } from "@adobe/aio-lib-state";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/product/get";
import { productStateKey } from "../actions-src/product/types/product";
import { getStateClient } from "../actions-src/utils/lib-state/state-client";

jest.mock("../actions-src/utils/lib-state/state-client");

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

describe("product get action", () => {
  let mockStateClient: jest.Mocked<AdobeState>;

  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
    mockStateClient = makeMockStateClient();
    mockGetStateClient.mockResolvedValue(mockStateClient);
  });

  it("returns the product when found", async () => {
    const product = { sku: "24-MB01", name: "Joust Duffle Bag" };
    mockStateClient.get.mockResolvedValue({ value: JSON.stringify(product), expiration: "" });

    const result = await main({ sku: "24-MB01" });

    expect(mockStateClient.get).toHaveBeenCalledWith(productStateKey("24-MB01"));
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ type: "Product fetched", response: { product } });
  });

  it("returns a 404 when the product is not found", async () => {
    mockStateClient.get.mockResolvedValue(undefined as never);

    const result = await main({ sku: "missing-sku" });

    expect(result.statusCode).toBe(404);
    expect(result.body).toMatchObject({ success: false });
  });

  it("returns a 500 error when state lookup fails", async () => {
    mockStateClient.get.mockRejectedValue(new Error("state unavailable"));

    const result = await main({ sku: "24-MB01" });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
