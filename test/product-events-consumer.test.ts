import { AdobeState } from "@adobe/aio-lib-state";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/product/events-consumer";
import { PRODUCT_STATE_TTL_SECONDS, productStateKey } from "../actions-src/product/types/product";
import { EventCode } from "../actions-src/utils/io-events/adobe-events-api";
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

describe("product events-consumer action", () => {
  let mockStateClient: jest.Mocked<AdobeState>;

  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
    mockStateClient = makeMockStateClient();
    mockGetStateClient.mockResolvedValue(mockStateClient);
  });

  it("upserts the product in state on a PRODUCT_SAVED event", async () => {
    const value = { sku: "24-MB01", name: "Joust Duffle Bag" };
    mockStateClient.put.mockResolvedValue(productStateKey(value.sku));

    const result = await main({ type: EventCode.PRODUCT_SAVED, data: { value } });

    expect(mockStateClient.put).toHaveBeenCalledWith(productStateKey(value.sku), JSON.stringify(value), {
      ttl: PRODUCT_STATE_TTL_SECONDS,
    });
    expect(mockStateClient.delete).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ type: EventCode.PRODUCT_SAVED });
  });

  it("removes the product from state on a PRODUCT_DELETED event", async () => {
    const value = { sku: "24-MB01" };
    mockStateClient.delete.mockResolvedValue(productStateKey(value.sku));

    const result = await main({ type: EventCode.PRODUCT_DELETED, data: { value } });

    expect(mockStateClient.delete).toHaveBeenCalledWith(productStateKey(value.sku));
    expect(mockStateClient.put).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ type: EventCode.PRODUCT_DELETED });
  });

  it("acknowledges an unrecognized event type without mutating state", async () => {
    const value = { sku: "24-MB01" };

    const result = await main({ type: "some.other.event", data: { value } });

    expect(mockStateClient.put).not.toHaveBeenCalled();
    expect(mockStateClient.delete).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ type: "some.other.event" });
  });

  it("returns a 500 error when the event payload is missing a sku", async () => {
    const result = await main({ type: EventCode.PRODUCT_SAVED, data: { value: { sku: "" } } });

    expect(mockStateClient.put).not.toHaveBeenCalled();
    expect(mockStateClient.delete).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });

  it("returns a 500 error when the state write fails", async () => {
    mockStateClient.put.mockRejectedValue(new Error("state unavailable"));

    const result = await main({ type: EventCode.PRODUCT_SAVED, data: { value: { sku: "24-MB01" } } });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
