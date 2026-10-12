import { AdobeState } from "@adobe/aio-lib-state";

export interface OrderNotification {
  id: string;
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

export const NOTIFICATIONS_INDEX_KEY = "order-notifications-index";
export const MAX_NOTIFICATIONS = 50;
// Recent-notifications feed, not permanent order history (Magento/the Orders
// page already is that) - 30 days comfortably covers "admin was away for a
// while" without the index growing unbounded.
export const NOTIFICATIONS_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function loadNotifications(stateClient: AdobeState): Promise<OrderNotification[]> {
  const result = await stateClient.get(NOTIFICATIONS_INDEX_KEY);
  if (!result?.value) {
    return [];
  }
  return JSON.parse(result.value) as OrderNotification[];
}

export async function saveNotifications(stateClient: AdobeState, notifications: OrderNotification[]): Promise<void> {
  await stateClient.put(NOTIFICATIONS_INDEX_KEY, JSON.stringify(notifications), {
    ttl: NOTIFICATIONS_TTL_SECONDS,
  });
}
