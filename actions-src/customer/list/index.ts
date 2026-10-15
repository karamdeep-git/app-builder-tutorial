import { initializeLogger } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse, UnexpectedCommerceResponseError } from "../../utils/adobe-commerce/errors";
import { buildSearchCriteriaQuery, SearchFilter } from "../../utils/adobe-commerce/search-criteria";
import { MagentoCustomer, toCustomerListItem } from "../types/customer";
import { COMMERCE_TIMEOUT_MS, CustomerListParams } from "../types/request";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_QUERY_LENGTH = 255;
const MAX_SEARCH_TERMS = 5;

const SEARCHABLE_FIELDS = ["email", "firstname", "lastname"] as const;

interface MagentoCustomerSearchResponse {
  items?: MagentoCustomer[];
  total_count?: number;
}

/**
 * Each whitespace-separated term becomes its own filter group (OR across
 * email/first/last name), and Magento ANDs the groups - so "veronica costello"
 * finds Veronica Costello even though no single field contains both words.
 */
function buildTermFilterGroups(query: string): SearchFilter[][] {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TERMS)
    .map((term) => SEARCHABLE_FIELDS.map((field) => ({ field, value: `%${term}%`, conditionType: "like" as const })));
}

/** Proxies Magento's default GET /V1/customers/search, newest customers first. */
export async function main(params: CustomerListParams): Promise<AppResponse> {
  initializeLogger("process-function", params.LOG_LEVEL ?? "info");

  try {
    const query = String(params.query ?? "").trim();
    if (query.length > MAX_QUERY_LENGTH) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, `Search text is too long (max ${MAX_QUERY_LENGTH} characters)`);
    }

    const page = Math.max(1, Math.trunc(Number(params.page)) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(params.pageSize)) || DEFAULT_PAGE_SIZE));

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
      timeoutMs: COMMERCE_TIMEOUT_MS,
    });

    const searchCriteria = buildSearchCriteriaQuery({
      filterGroups: buildTermFilterGroups(query),
      sortOrders: [{ field: "created_at", direction: "DESC" }],
      pageSize,
      currentPage: page,
    });
    const response = await client.get<MagentoCustomerSearchResponse>(`/customers/search?${searchCriteria}`);

    if (!Array.isArray(response?.items)) {
      throw new UnexpectedCommerceResponseError("GET /customers/search returned no items array");
    }

    return successResponse("Customer list", {
      items: response.items.map(toCustomerListItem),
      totalCount: response.total_count ?? response.items.length,
      page,
      pageSize,
    });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Customer search");
  }
}
