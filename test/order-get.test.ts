import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/order/get";
import { OrderGetParams } from "../actions-src/order/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: OrderGetParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
  orderId: 1,
};

function mockOrderAndShipments(order: unknown, shipments: { items: unknown[] } = { items: [] }) {
  mockAxios.mockImplementation((config: unknown) => {
    const url = (config as { url: string }).url;
    if (url.includes("/shipments")) {
      return Promise.resolve({ data: shipments });
    }
    return Promise.resolve({ data: order });
  });
}

describe("order get action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("returns the full order detail alongside shipment tracks", async () => {
    const order = { entity_id: 1, increment_id: "000000001", status: "processing", items: [{ sku: "24-MB01" }] };
    mockOrderAndShipments(order, {
      items: [{ entity_id: 10, tracks: [{ track_number: "1Z999", carrier_code: "ups", title: "UPS" }] }],
    });

    const result = await main(baseParams);

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      type: "Order detail",
      response: {
        order,
        tracks: [{ track_number: "1Z999", carrier_code: "ups", title: "UPS" }],
      },
    });
  });

  it("filters shipments by order_id", async () => {
    mockOrderAndShipments({ entity_id: 1 });

    await main(baseParams);

    const calls = mockAxios.mock.calls as unknown as { url: string }[][];
    const shipmentsCall = calls.find(([config]) => config.url.includes("/shipments"));
    const url = shipmentsCall?.[0].url ?? "";
    expect(url).toContain("searchCriteria[filter_groups][0][filters][0][field]=order_id");
    expect(url).toContain("searchCriteria[filter_groups][0][filters][0][value]=1");
  });

  it("returns an empty tracks array when the order has no shipments", async () => {
    mockOrderAndShipments({ entity_id: 1 }, { items: [] });

    const result = await main(baseParams);

    expect(result.body).toMatchObject({ response: { tracks: [] } });
  });

  it("rejects a request with neither orderId nor incrementId", async () => {
    const result = await main({ ...baseParams, orderId: "" });

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("resolves the real order via increment_id when orderId isn't provided (eg. opened from a notification)", async () => {
    const order = { entity_id: 42, increment_id: "000000042", status: "pending" };
    mockAxios.mockImplementation((config: unknown) => {
      const url = (config as { url: string }).url;
      if (url.includes("/shipments")) {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url.includes("increment_id")) {
        expect(url).toContain("searchCriteria[filter_groups][0][filters][0][value]=000000042");
        return Promise.resolve({ data: { items: [order] } });
      }
      // The follow-up direct fetch must use the *resolved* numeric entity_id.
      expect(url).toContain("/orders/42");
      return Promise.resolve({ data: order });
    });

    const result = await main({ ...baseParams, orderId: undefined, incrementId: "000000042" });

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ response: { order } });
  });

  it("returns a 404 when no order matches the given incrementId", async () => {
    mockAxios.mockImplementation((config: unknown) => {
      const url = (config as { url: string }).url;
      if (url.includes("increment_id")) {
        return Promise.resolve({ data: { items: [] } });
      }
      return Promise.resolve({ data: {} });
    });

    const result = await main({ ...baseParams, orderId: undefined, incrementId: "000000999" });

    expect(result.statusCode).toBe(404);
    expect(result.body).toMatchObject({ success: false });
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 404"));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
