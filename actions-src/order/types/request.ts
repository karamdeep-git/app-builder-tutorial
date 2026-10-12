import { BaseParams } from "../../types/request";
import { CommerceParams } from "../../utils/adobe-commerce/types/request";

export interface OrderSearchQueryParams {
  query?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number | string;
  pageSize?: number | string;
}

export type OrderSearchParams = BaseParams & CommerceParams & OrderSearchQueryParams;

export interface OrderGetQueryParams {
  // Either is accepted - incrementId covers callers (eg. order notifications)
  // that only ever have Magento's increment_id available, never entity_id.
  orderId?: number | string;
  incrementId?: string;
}

export type OrderGetParams = BaseParams & CommerceParams & OrderGetQueryParams;

export interface OrderActionData {
  orderId: number | string;
}

export type OrderCancelParams = BaseParams & CommerceParams & OrderActionData;
export type OrderHoldParams = BaseParams & CommerceParams & OrderActionData;
export type OrderUnholdParams = BaseParams & CommerceParams & OrderActionData;

// Shape of the `observer.sales_order_place_after` event payload - the fields
// selected via `bin/magento events:subscribe --fields=order.<field>` (see
// CONFIGURATION.md), confirmed against Adobe's own event trace API. Notably
// NOT present even when requested: `entity_id` and `created_at` - Magento's
// event payload omits them for this event regardless of field selection, so
// increment_id is the only reliable identifier here. Deliberately excludes
// email, addresses, items and payment data, none of which this event needs
// to expose.
export interface OrderPlacedEventValue {
  increment_id: string;
  customer_firstname?: string;
  customer_lastname?: string;
  customer_is_guest?: number;
  grand_total: number;
  order_currency_code?: string;
  status: string;
}

export type OrderEventParams = BaseParams & {
  type: string;
  data: {
    // Nested under "order" because the field paths were subscribed as
    // `order.<field>` (see CONFIGURATION.md) - Magento's event converter
    // wraps the payload under the dispatch array's key ("order" for
    // `sales_order_place_after`), confirmed live via Adobe's trace API.
    value: {
      order?: Partial<OrderPlacedEventValue>;
    };
  };
};
