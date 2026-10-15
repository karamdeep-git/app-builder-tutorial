import { AdobeState } from "@adobe/aio-lib-state";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/notifications/list";
import { OrderNotification } from "../actions-src/notifications/types/notification";
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

describe("notifications list action", () => {
  let mockStateClient: jest.Mocked<AdobeState>;

  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
    mockStateClient = makeMockStateClient();
    mockGetStateClient.mockResolvedValue(mockStateClient);
  });

  it("returns an empty list and zero unread count when nothing has been stored yet", async () => {
    mockStateClient.get.mockResolvedValue(undefined as never);

    const result = await main({});

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ response: { notifications: [], unreadCount: 0 } });
  });

  it("returns stored notifications and counts only the unread ones", async () => {
    const notifications: OrderNotification[] = [
      { id: "order-000000001", incrementId: "000000001", customerName: "A", grandTotal: 10, status: "pending", createdAt: "x", read: false },
      { id: "order-000000002", incrementId: "000000002", customerName: "B", grandTotal: 20, status: "pending", createdAt: "y", read: true },
    ];
    mockStateClient.get.mockResolvedValue({ value: JSON.stringify(notifications), expiration: "" });

    const result = await main({});

    expect(result.body).toMatchObject({ response: { notifications, unreadCount: 1 } });
  });

  it("never shows the duplicate low-stock alert two overlapping runs stored, nor counts it as unread", async () => {
    // The real pair from the first deploy: same products, posted ~1s apart.
    const products = [
      { sku: "test123", name: "storeparam-test", qty: 1 },
      { sku: "Test121", name: "Test", qty: 2 },
    ];
    const stored = [
      { id: "low-stock-2", type: "low_stock", products, totalCount: 2, threshold: 5, createdAt: "2026-10-13T06:09:17.100Z", read: false },
      { id: "low-stock-1", type: "low_stock", products, totalCount: 2, threshold: 5, createdAt: "2026-10-13T06:09:16.200Z", read: false },
    ];
    mockStateClient.get.mockResolvedValue({ value: JSON.stringify(stored), expiration: "" });

    const result = await main({});

    expect(result.body).toMatchObject({ response: { notifications: [{ id: "low-stock-2" }], unreadCount: 1 } });
    expect((result.body as { response: { notifications: unknown[] } }).response.notifications).toHaveLength(1);
  });

  it("returns a 500 error when the state read fails", async () => {
    mockStateClient.get.mockRejectedValue(new Error("state unavailable"));

    const result = await main({});

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
