import { AdobeState } from "@adobe/aio-lib-state";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/notifications/mark-read";
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

const twoNotifications: OrderNotification[] = [
  { id: "order-000000001", incrementId: "000000001", customerName: "A", grandTotal: 10, status: "pending", createdAt: "x", read: false },
  { id: "order-000000002", incrementId: "000000002", customerName: "B", grandTotal: 20, status: "pending", createdAt: "y", read: false },
];

describe("notifications mark-read action", () => {
  let mockStateClient: jest.Mocked<AdobeState>;

  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
    mockStateClient = makeMockStateClient();
    mockGetStateClient.mockResolvedValue(mockStateClient);
  });

  it("marks only the matching id as read, leaving others untouched", async () => {
    mockStateClient.get.mockResolvedValue({ value: JSON.stringify(twoNotifications), expiration: "" });

    const result = await main({ id: "order-000000001" });

    const [, savedJson] = mockStateClient.put.mock.calls[0];
    const saved = JSON.parse(savedJson) as OrderNotification[];
    expect(saved.find((n) => n.id === "order-000000001")?.read).toBe(true);
    expect(saved.find((n) => n.id === "order-000000002")?.read).toBe(false);
    expect(result.body).toMatchObject({ response: { unreadCount: 1 } });
  });

  it("marks every notification as read when all=true", async () => {
    mockStateClient.get.mockResolvedValue({ value: JSON.stringify(twoNotifications), expiration: "" });

    const result = await main({ all: true });

    const [, savedJson] = mockStateClient.put.mock.calls[0];
    const saved = JSON.parse(savedJson) as OrderNotification[];
    expect(saved.every((n) => n.read)).toBe(true);
    expect(result.body).toMatchObject({ response: { unreadCount: 0 } });
  });

  it("rejects a request with neither id nor all", async () => {
    const result = await main({});

    expect(result.statusCode).toBe(400);
    expect(mockStateClient.get).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the state write fails", async () => {
    mockStateClient.get.mockResolvedValue({ value: JSON.stringify(twoNotifications), expiration: "" });
    mockStateClient.put.mockRejectedValue(new Error("state unavailable"));

    const result = await main({ all: true });

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
