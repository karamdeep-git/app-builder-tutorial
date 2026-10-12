export interface MagentoOrderAddress {
  firstname?: string;
  lastname?: string;
  street?: string[];
  city?: string;
  region?: string;
  postcode?: string;
  country_id?: string;
  telephone?: string;
  email?: string;
}

export interface MagentoOrderItem {
  item_id: number;
  sku: string;
  name: string;
  qty_ordered: number;
  price: number;
  row_total: number;
  product_type?: string;
}

export interface MagentoOrderPayment {
  method?: string;
  amount_paid?: number;
  amount_ordered?: number;
  cc_last4?: string | null;
  additional_information?: string[];
}

export interface MagentoStatusHistory {
  entity_id: number;
  comment?: string | null;
  status?: string;
  created_at: string;
  is_customer_notified?: number;
}

export interface MagentoOrder {
  entity_id: number;
  increment_id: string;
  state: string;
  status: string;
  created_at: string;
  updated_at?: string;
  customer_email?: string;
  customer_firstname?: string;
  customer_lastname?: string;
  customer_is_guest?: number;
  grand_total: number;
  subtotal?: number;
  discount_amount?: number;
  shipping_amount?: number;
  tax_amount?: number;
  total_paid?: number;
  total_due?: number;
  total_refunded?: number | null;
  order_currency_code?: string;
  shipping_description?: string;
  items?: MagentoOrderItem[];
  billing_address?: MagentoOrderAddress;
  payment?: MagentoOrderPayment;
  status_histories?: MagentoStatusHistory[];
  extension_attributes?: {
    shipping_assignments?: Array<{
      shipping?: {
        address?: MagentoOrderAddress;
        method?: string;
      };
    }>;
  };
}

export type PaymentStatus = "Paid" | "Partially Paid" | "Pending" | "Refunded";

/**
 * Magento has no single "payment status" field - this mirrors how its own
 * Sales grid reasons about total_paid/total_due/total_refunded, consistent
 * with the "Salable Quantity" style simplifications already documented for
 * the product grid (see CONFIGURATION.md).
 */
export function derivePaymentStatus(order: Pick<MagentoOrder, "total_paid" | "total_due" | "total_refunded">): PaymentStatus {
  const paid = Number(order.total_paid ?? 0);
  const due = Number(order.total_due ?? 0);
  const refunded = Number(order.total_refunded ?? 0);

  if (refunded > 0) return "Refunded";
  if (paid > 0 && due <= 0) return "Paid";
  if (paid > 0 && due > 0) return "Partially Paid";
  return "Pending";
}

/** "pending_payment" -> "Pending Payment" */
export function formatStatusLabel(status: string | undefined): string {
  if (!status) return "-";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getCustomerName(order: Pick<MagentoOrder, "customer_firstname" | "customer_lastname">): string {
  const name = `${order.customer_firstname ?? ""} ${order.customer_lastname ?? ""}`.trim();
  return name || "Guest";
}
