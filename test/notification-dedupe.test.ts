import { AppNotification, dedupeNotifications } from "../actions-src/notifications/types/notification";

const products = [
  { sku: "test123", name: "storeparam-test", qty: 1 },
  { sku: "Test121", name: "Test", qty: 2 },
];

function lowStock(id: string, createdAt: string, overrides: Partial<AppNotification> = {}): AppNotification {
  return { id, type: "low_stock", products, totalCount: 2, threshold: 5, createdAt, read: false, ...overrides } as AppNotification;
}

function order(id: string, incrementId: string, read = false): AppNotification {
  return { id, type: "order", incrementId, customerName: "A", grandTotal: 1, status: "pending", createdAt: "x", read };
}

describe("dedupeNotifications", () => {
  it("collapses low-stock alerts for the same products posted within a minute, keeping the newest", () => {
    const result = dedupeNotifications([
      lowStock("b", "2026-10-13T06:09:17.000Z"),
      lowStock("a", "2026-10-13T06:09:16.000Z"),
    ]);

    expect(result.map((n) => n.id)).toEqual(["b"]);
  });

  it("treats the same products in a different order as the same alert", () => {
    const reversed = [...products].reverse();
    const result = dedupeNotifications([
      lowStock("b", "2026-10-13T06:09:17.000Z"),
      lowStock("a", "2026-10-13T06:09:16.000Z", { products: reversed } as Partial<AppNotification>),
    ]);

    expect(result).toHaveLength(1);
  });

  it("keeps a genuine re-alert for the same products posted later (restocked, then low again)", () => {
    const result = dedupeNotifications([
      lowStock("later", "2026-10-13T08:00:00.000Z"),
      lowStock("earlier", "2026-10-13T06:00:00.000Z"),
    ]);

    expect(result.map((n) => n.id)).toEqual(["later", "earlier"]);
  });

  it("keeps alerts for different products even when posted together", () => {
    const result = dedupeNotifications([
      lowStock("b", "2026-10-13T06:09:17.000Z", { products: [products[0]], totalCount: 1 } as Partial<AppNotification>),
      lowStock("a", "2026-10-13T06:09:16.000Z"),
    ]);

    expect(result).toHaveLength(2);
  });

  it("collapses notifications for the same order, and identical ids", () => {
    const result = dedupeNotifications([
      order("order-7", "000000007"),
      order("order-7-again", "000000007"),
      order("order-8", "000000008"),
      order("order-8", "000000008"),
    ]);

    expect(result.map((n) => n.id)).toEqual(["order-7", "order-8"]);
  });

  it("marks the kept copy read if any duplicate was read", () => {
    const result = dedupeNotifications([order("order-7", "000000007", false), order("order-7b", "000000007", true)]);

    expect(result).toEqual([expect.objectContaining({ id: "order-7", read: true })]);
  });

  it("never treats an order and a low-stock alert as duplicates, and doesn't mutate its input", () => {
    const input = [lowStock("low", "2026-10-13T06:09:17.000Z"), order("order-7", "000000007")];
    const snapshot = JSON.parse(JSON.stringify(input));

    const result = dedupeNotifications(input);

    expect(result).toHaveLength(2);
    expect(input).toEqual(snapshot);
  });
});
