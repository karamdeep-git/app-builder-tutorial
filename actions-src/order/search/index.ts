import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { derivePaymentStatus, getCustomerName, MagentoOrder } from "../types/order";
import { OrderSearchParams } from "../types/request";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface MagentoOrderSearchResponse {
  items: MagentoOrder[];
  total_count: number;
}

/** OR-matched across order number and the customer identity fields, per spec section 1. */
const SEARCHABLE_FIELDS = ["increment_id", "customer_email", "customer_firstname", "customer_lastname"] as const;

/**
 * Builds a Magento `searchCriteria` query string for GET /V1/orders - the
 * default Commerce REST endpoint confirmed (via live inspection and source
 * reading) to be the only way to list orders across all customers; Magento's
 * GraphQL order queries are scoped to a single authenticated customer's own
 * identity and cannot list store-wide.
 *
 * Keys are left with literal, unencoded `[`/`]` - see product/search's
 * buildSearchCriteriaQuery for why (oauth-1.0a signs the raw key but
 * percent-encodes it once itself; a pre-encoded key would be double-encoded
 * and invalidate the signature). Only values are encoded.
 */
function buildOrderSearchCriteriaQuery(params: {
  query: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
}): string {
  const parts: string[] = [];
  let groupIndex = 0;

  if (params.query) {
    const likeValue = `%${params.query}%`;
    SEARCHABLE_FIELDS.forEach((field, index) => {
      const prefix = `searchCriteria[filter_groups][${groupIndex}][filters][${index}]`;
      parts.push(`${prefix}[field]=${encodeURIComponent(field)}`);
      parts.push(`${prefix}[value]=${encodeURIComponent(likeValue)}`);
      parts.push(`${prefix}[condition_type]=like`);
    });
    groupIndex++;
  }

  if (params.status) {
    const prefix = `searchCriteria[filter_groups][${groupIndex}][filters][0]`;
    parts.push(`${prefix}[field]=status`);
    parts.push(`${prefix}[value]=${encodeURIComponent(params.status)}`);
    parts.push(`${prefix}[condition_type]=eq`);
    groupIndex++;
  }

  if (params.dateFrom) {
    const prefix = `searchCriteria[filter_groups][${groupIndex}][filters][0]`;
    parts.push(`${prefix}[field]=created_at`);
    parts.push(`${prefix}[value]=${encodeURIComponent(`${params.dateFrom} 00:00:00`)}`);
    parts.push(`${prefix}[condition_type]=gteq`);
    groupIndex++;
  }

  if (params.dateTo) {
    const prefix = `searchCriteria[filter_groups][${groupIndex}][filters][0]`;
    parts.push(`${prefix}[field]=created_at`);
    parts.push(`${prefix}[value]=${encodeURIComponent(`${params.dateTo} 23:59:59`)}`);
    parts.push(`${prefix}[condition_type]=lteq`);
    groupIndex++;
  }

  parts.push(`searchCriteria[sortOrders][0][field]=created_at`);
  parts.push(`searchCriteria[sortOrders][0][direction]=DESC`);
  parts.push(`searchCriteria[pageSize]=${params.pageSize}`);
  parts.push(`searchCriteria[currentPage]=${params.page}`);

  return parts.join("&");
}

export async function main(params: OrderSearchParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const query = (params.query ?? "").trim();
    const status = (params.status ?? "").trim();
    const dateFrom = (params.dateFrom ?? "").trim();
    const dateTo = (params.dateTo ?? "").trim();

    const page = Math.max(1, Math.trunc(Number(params.page)) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(params.pageSize)) || DEFAULT_PAGE_SIZE));

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const resourceUrl = `/orders?${buildOrderSearchCriteriaQuery({ query, status, dateFrom, dateTo, page, pageSize })}`;
    const response = await client.get<MagentoOrderSearchResponse>(resourceUrl);

    const items = (response.items ?? []).map((order) => ({
      id: order.entity_id,
      incrementId: order.increment_id,
      customerName: getCustomerName(order),
      customerEmail: order.customer_email ?? "-",
      createdAt: order.created_at,
      status: order.status,
      state: order.state,
      paymentStatus: derivePaymentStatus(order),
      grandTotal: order.grand_total,
      currencyCode: order.order_currency_code,
    }));

    return successResponse("Order search", {
      items,
      totalCount: response.total_count ?? 0,
      page,
      pageSize,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
