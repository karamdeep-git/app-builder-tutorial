// Wording for low_stock notifications (posted by the scheduled
// inventory/low-stock-check action), shared by the bell and the toast.
// Notifications with no `type` predate low-stock alerts and are all orders.

const PRODUCTS_IN_SUMMARY = 3;

export function isLowStock(notification) {
  return notification?.type === "low_stock";
}

export function lowStockTitle(notification) {
  const count = notification.totalCount ?? notification.products?.length ?? 0;
  return `Low stock: ${count} ${count === 1 ? "product" : "products"}`;
}

// e.g. "MB01 (2 left), MB02 (0 left), WS03 (1 left), +2 more"
export function lowStockSummary(notification) {
  const products = notification.products ?? [];
  const listed = products.slice(0, PRODUCTS_IN_SUMMARY).map((product) => `${product.sku} (${product.qty} left)`);
  const remaining = (notification.totalCount ?? products.length) - listed.length;
  return remaining > 0 ? `${listed.join(", ")}, +${remaining} more` : listed.join(", ");
}
