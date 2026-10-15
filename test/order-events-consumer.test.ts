import { AdobeState } from "@adobe/aio-lib-state";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/order/events-consumer";
import { NOTIFICATIONS_INDEX_KEY, OrderNotification } from "../actions-src/notifications/types/notification";
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

// Matches the real payload confirmed live via Adobe's event trace API -
// nested under an "order" key (the dispatch array's key for
// sales_order_place_after), and notably no entity_id/created_at regardless
// of field selection.
const orderValue = {
  order: {
    increment_id: "000000007",
    customer_firstname: "Jane",
    customer_lastname: "Doe",
    grand_total: 150,
    order_currency_code: "USD",
    status: "pending",
  },
};

describe("order events-consumer action", () => {
  let mockStateClient: jest.Mocked<AdobeState>;

  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
    mockStateClient = makeMockStateClient();
    mockGetStateClient.mockResolvedValue(mockStateClient);
  });

  it("creates a notification on an ORDER_PLACED event with no existing notifications", async () => {
    mockStateClient.get.mockResolvedValue(undefined as never);

    const result = await main({ type: EventCode.ORDER_PLACED, data: { value: orderValue } });

    expect(mockStateClient.put).toHaveBeenCalledWith(
      NOTIFICATIONS_INDEX_KEY,
      expect.stringContaining('"incrementId":"000000007"'),
      expect.objectContaining({ ttl: expect.any(Number) })
    );
    const [, savedJson] = mockStateClient.put.mock.calls[0];
    const saved = JSON.parse(savedJson) as OrderNotification[];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: "order-000000007",
      incrementId: "000000007",
      customerName: "Jane Doe",
      grandTotal: 150,
      status: "pending",
      read: false,
    });
    expect(result.statusCode).toBe(200);
  });

  it("prepends to existing notifications, newest first", async () => {
    const existing: OrderNotification[] = [
      { id: "order-000000001", incrementId: "000000001", customerName: "A", grandTotal: 10, status: "pending", createdAt: "x", read: false },
    ];
    mockStateClient.get.mockResolvedValue({ value: JSON.stringify(existing), expiration: "" });

    await main({ type: EventCode.ORDER_PLACED, data: { value: orderValue } });

    const [, savedJson] = mockStateClient.put.mock.calls[0];
    const saved = JSON.parse(savedJson) as OrderNotification[];
    expect(saved.map((n) => n.incrementId)).toEqual(["000000007", "000000001"]);
  });

  it("does not create a duplicate notification for an order that already has one", async () => {
    const existing: OrderNotification[] = [
      { id: "order-000000007", incrementId: "000000007", customerName: "Jane Doe", grandTotal: 150, status: "pending", createdAt: "x", read: false },
    ];
    mockStateClient.get.mockResolvedValue({ value: JSON.stringify(existing), expiration: "" });

    const result = await main({ type: EventCode.ORDER_PLACED, data: { value: orderValue } });

    expect(mockStateClient.put).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ response: { message: expect.stringContaining("Duplicate") } });
  });

  it("tags new notifications as type 'order' and isn't confused by low-stock notifications in the list", async () => {
    const lowStock = { id: "low-stock-1", type: "low_stock", products: [], totalCount: 1, threshold: 5, createdAt: "x", read: false };
    mockStateClient.get.mockResolvedValue({ value: JSON.stringify([lowStock]), expiration: "" });

    await main({ type: EventCode.ORDER_PLACED, data: { value: orderValue } });

    const [, savedJson] = mockStateClient.put.mock.calls[0];
    const saved = JSON.parse(savedJson);
    expect(saved[0]).toMatchObject({ type: "order", incrementId: "000000007" });
    expect(saved[1]).toEqual(lowStock);
  });

  it("ignores unrecognized event types without touching state", async () => {
    const result = await main({ type: "some.other.event", data: { value: orderValue } });

    expect(mockStateClient.get).not.toHaveBeenCalled();
    expect(mockStateClient.put).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
  });

  it("returns a 500 error when the event payload is missing increment_id", async () => {
    const result = await main({ type: EventCode.ORDER_PLACED, data: { value: { order: { status: "pending" } } } });

    expect(mockStateClient.put).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });

  it("returns a 500 error when the event payload has no order key at all", async () => {
    const result = await main({ type: EventCode.ORDER_PLACED, data: { value: {} } });

    expect(mockStateClient.put).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });

  it("returns a 500 error when the state write fails", async () => {
    mockStateClient.get.mockResolvedValue(undefined as never);
    mockStateClient.put.mockRejectedValue(new Error("state unavailable"));

    const result = await main({ type: EventCode.ORDER_PLACED, data: { value: orderValue } });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
