import { initializeLogger } from "../../logger";
import { successResponse } from "../../responses";
import { AppResponse } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { getProductThumbnailPath, Product } from "../types/product";
import { ProductSearchParams } from "../types/request";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface MagentoProductSearchResponse {
  items: Product[];
  total_count: number;
}

interface AttributeSet {
  attribute_set_id: number;
  attribute_set_name: string;
}

interface Website {
  id: number;
  name: string;
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  simple: "Simple Product",
  configurable: "Configurable Product",
  virtual: "Virtual Product",
  bundle: "Bundle Product",
  downloadable: "Downloadable Product",
  giftcard: "Gift Card",
};

const VISIBILITY_LABELS: Record<number, string> = {
  1: "Not Visible Individually",
  2: "Catalog",
  3: "Search",
  4: "Catalog, Search",
};

/**
 * Both lookups are small, store-wide reference data (attribute sets, websites)
 * that almost never changes - fetched once per request (not once per item) and
 * applied to every row in the current page.
 */
async function loadAttributeSetNames(client: AdobeCommerceClient): Promise<Map<number, string>> {
  const result = await client.get<{ items: AttributeSet[] }>(
    "/products/attribute-sets/sets/list?searchCriteria[pageSize]=200&searchCriteria[currentPage]=1"
  );
  return new Map((result.items ?? []).map((set) => [set.attribute_set_id, set.attribute_set_name]));
}

async function loadWebsiteNames(client: AdobeCommerceClient): Promise<Map<number, string>> {
  const websites = await client.get<Website[]>("/store/websites");
  return new Map((websites ?? []).map((site) => [site.id, site.name]));
}

/**
 * Builds a Magento `searchCriteria` query string. With a non-empty `query`,
 * OR-matches it against sku and name via a single filter_group (multiple
 * filters in one group are OR'd by Magento's search criteria semantics).
 * With an empty `query`, omits the filter_groups entirely - Magento's search
 * criteria treats "no filters" as "match everything" - so this doubles as a
 * plain paginated "browse all products" listing. Always sorted by created_at
 * descending (newest first), including search results - both for the
 * requested "latest first" ordering and so paging is stable across requests
 * (without an explicit sort, page order isn't guaranteed to stay consistent).
 *
 * Keys are left with literal, unencoded `[`/`]`. The oauth-1.0a library
 * decodes each query param's value but never its key when reconstructing the
 * signature base string, then percent-encodes the key exactly once - so a
 * pre-encoded key (e.g. from URLSearchParams) gets double-encoded and the
 * signature no longer matches what Magento computes. Only values are encoded.
 */
function buildSearchCriteriaQuery(query: string, page: number, pageSize: number): string {
  const parts: string[] = [];

  if (query) {
    const likeValue = `%${query}%`;
    (["sku", "name"] as const).forEach((field, index) => {
      const prefix = `searchCriteria[filter_groups][0][filters][${index}]`;
      parts.push(`${prefix}[field]=${encodeURIComponent(field)}`);
      parts.push(`${prefix}[value]=${encodeURIComponent(likeValue)}`);
      parts.push(`${prefix}[condition_type]=like`);
    });
  }

  parts.push(`searchCriteria[sortOrders][0][field]=created_at`);
  parts.push(`searchCriteria[sortOrders][0][direction]=DESC`);
  parts.push(`searchCriteria[pageSize]=${pageSize}`);
  parts.push(`searchCriteria[currentPage]=${page}`);

  return parts.join("&");
}

export async function main(params: ProductSearchParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const query = (params.query ?? "").trim();

    const page = Math.max(1, Math.trunc(Number(params.page)) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(params.pageSize)) || DEFAULT_PAGE_SIZE));

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const resourceUrl = `/products?${buildSearchCriteriaQuery(query, page, pageSize)}`;
    const [response, attributeSetNames, websiteNames] = await Promise.all([
      client.get<MagentoProductSearchResponse>(resourceUrl),
      loadAttributeSetNames(client),
      loadWebsiteNames(client),
    ]);

    const items = (response.items ?? []).map((item) => {
      const websiteIds = (item.extension_attributes?.website_ids as number[] | undefined) ?? [];
      return {
        ...item,
        thumbnailPath: getProductThumbnailPath(item),
        typeLabel: PRODUCT_TYPE_LABELS[item.type_id ?? ""] ?? item.type_id ?? "-",
        attributeSetName: attributeSetNames.get(item.attribute_set_id as number) ?? "-",
        visibilityLabel: VISIBILITY_LABELS[item.visibility as number] ?? "-",
        websiteNames: websiteIds.map((id) => websiteNames.get(id) ?? `#${id}`),
      };
    });

    return successResponse("Product search", {
      items,
      totalCount: response.total_count ?? 0,
      page,
      pageSize,
    });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Product search");
  }
}
