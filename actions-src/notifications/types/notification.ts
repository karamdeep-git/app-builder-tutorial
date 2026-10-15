import { AdobeState } from "@adobe/aio-lib-state";

export interface OrderNotification {
  id: string;
  // Optional: notifications saved before low-stock alerts existed have no
  // `type`, and are all orders - see isOrderNotification.
  type?: "order";
  // Magento's own `sales_order_place_after` event payload (confirmed live via
  // Adobe's event trace API) omits entity_id by design - increment_id is the
  // identifier available, and is the stable, externally-meaningful one anyway.
  incrementId: string;
  customerName: string;
  grandTotal: number;
  currencyCode?: string;
  status: string;
  createdAt: string;
  read: boolean;
}

export interface LowStockProduct {
  sku: string;
  name: string;
  qty: number;
}

/** Posted by the scheduled inventory/low-stock-check action - one per run that finds newly low products. */
export interface LowStockNotification {
  id: string;
  type: "low_stock";
  // Capped at MAX_LOW_STOCK_PRODUCTS_PER_NOTIFICATION; totalCount is the real number.
  products: LowStockProduct[];
  totalCount: number;
  threshold: number;
  createdAt: string;
  read: boolean;
}

export type AppNotification = OrderNotification | LowStockNotification;

export function isOrderNotification(notification: AppNotification): notification is OrderNotification {
  return notification.type !== "low_stock";
}

// Keeps the single notifications key small: 50 notifications x 10 products.
export const MAX_LOW_STOCK_PRODUCTS_PER_NOTIFICATION = 10;

// Two overlapping low-stock runs can each post the same alert (seen live on
// the first deploy - see inventory/low-stock-check). Alerts listing the same
// products this close together are one alert. Genuine re-alerts need a run in
// between that saw the product restocked, so they're always further apart.
export const DUPLICATE_LOW_STOCK_WINDOW_MS = 60 * 1000;

function lowStockKey(notification: LowStockNotification): string {
  const skus = notification.products.map((product) => product.sku).sort();
  return `${notification.totalCount}|${skus.join("\n")}`;
}

export function isSameLowStockAlert(a: LowStockNotification, b: LowStockNotification): boolean {
  return (
    lowStockKey(a) === lowStockKey(b) &&
    Math.abs(Date.parse(a.createdAt) - Date.parse(b.createdAt)) < DUPLICATE_LOW_STOCK_WINDOW_MS
  );
}

function isSameNotification(a: AppNotification, b: AppNotification): boolean {
  if (a.id === b.id) return true;
  if (isOrderNotification(a) && isOrderNotification(b)) return a.incrementId === b.incrementId;
  if (!isOrderNotification(a) && !isOrderNotification(b)) return isSameLowStockAlert(a, b);
  return false;
}

/**
 * Collapses duplicates, keeping the first (newest) copy - marked read if any
 * copy was read. Applied on every load, so nothing reading notifications ever
 * sees a duplicate, and the next save drops it from storage for good.
 */
export function dedupeNotifications(notifications: AppNotification[]): AppNotification[] {
  const kept: AppNotification[] = [];
  for (const notification of notifications) {
    const existing = kept.find((candidate) => isSameNotification(candidate, notification));
    if (existing) {
      existing.read = existing.read || notification.read;
    } else {
      kept.push({ ...notification });
    }
  }
  return kept;
}

// Key name predates low-stock alerts; kept so existing notifications survive.
export const NOTIFICATIONS_INDEX_KEY = "order-notifications-index";
export const MAX_NOTIFICATIONS = 50;
// Recent-notifications feed, not permanent order history (Magento/the Orders
// page already is that) - 30 days comfortably covers "admin was away for a
// while" without the index growing unbounded.
export const NOTIFICATIONS_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function loadNotifications(stateClient: AdobeState): Promise<AppNotification[]> {
  const result = await stateClient.get(NOTIFICATIONS_INDEX_KEY);
  if (!result?.value) {
    return [];
  }
  return dedupeNotifications(JSON.parse(result.value) as AppNotification[]);
}

export async function saveNotifications(stateClient: AdobeState, notifications: AppNotification[]): Promise<void> {
  await stateClient.put(NOTIFICATIONS_INDEX_KEY, JSON.stringify(notifications), {
    ttl: NOTIFICATIONS_TTL_SECONDS,
  });
}
