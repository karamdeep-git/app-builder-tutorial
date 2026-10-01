import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { Product } from "../types/product";
import { ProductSearchParams } from "../types/request";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface MagentoProductSearchResponse {
  items: Product[];
  total_count: number;
}

/**
 * Builds a Magento `searchCriteria` query string that OR-matches `query`
 * against sku and name via a single filter_group (multiple filters in one
 * group are OR'd by Magento's search criteria semantics).
 *
 * Keys are left with literal, unencoded `[`/`]`. The oauth-1.0a library
 * decodes each query param's value but never its key when reconstructing the
 * signature base string, then percent-encodes the key exactly once - so a
 * pre-encoded key (e.g. from URLSearchParams) gets double-encoded and the
 * signature no longer matches what Magento computes. Only values are encoded.
 */
function buildSearchCriteriaQuery(query: string, page: number, pageSize: number): string {
  const likeValue = `%${query}%`;
  const parts: string[] = [];

  (["sku", "name"] as const).forEach((field, index) => {
    const prefix = `searchCriteria[filter_groups][0][filters][${index}]`;
    parts.push(`${prefix}[field]=${encodeURIComponent(field)}`);
    parts.push(`${prefix}[value]=${encodeURIComponent(likeValue)}`);
    parts.push(`${prefix}[condition_type]=like`);
  });

  parts.push(`searchCriteria[pageSize]=${pageSize}`);
  parts.push(`searchCriteria[currentPage]=${page}`);

  return parts.join("&");
}

export async function main(params: ProductSearchParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const query = (params.query ?? "").trim();
    if (!query) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing query");
    }

    const page = Math.max(1, Math.trunc(Number(params.page)) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(params.pageSize)) || DEFAULT_PAGE_SIZE));

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const resourceUrl = `/products?${buildSearchCriteriaQuery(query, page, pageSize)}`;
    const response = await client.get<MagentoProductSearchResponse>(resourceUrl);

    return successResponse("Product search", {
      items: response.items ?? [],
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
