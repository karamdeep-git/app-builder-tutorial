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

  it("returns a 500 error when the state read fails", async () => {
    mockStateClient.get.mockRejectedValue(new Error("state unavailable"));

    const result = await main({});

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
