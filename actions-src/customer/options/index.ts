import { initializeLogger } from "../../logger";
import { successResponse } from "../../responses";
import { AppResponse } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse, UnexpectedCommerceResponseError } from "../../utils/adobe-commerce/errors";
import { buildSearchCriteriaQuery } from "../../utils/adobe-commerce/search-criteria";
import { COMMERCE_TIMEOUT_MS, CustomerOptionsParams } from "../types/request";

// Far above any real store's group count; Magento has no "all" page size.
const GROUP_PAGE_SIZE = 200;

// Id 0 is Magento's built-in admin website/store and its "NOT LOGGED IN"
// group - none of them can be assigned to a customer account, so Magento's
// own Admin customer form leaves them out too.
const RESERVED_ID = 0;

interface MagentoGroup {
  id: number;
  code: string;
}

interface MagentoWebsite {
  id: number;
  code: string;
  name: string;
}

interface MagentoStoreView {
  id: number;
  code: string;
  name: string;
  website_id: number;
  is_active: number;
}

function requireArray<T>(value: unknown, endpoint: string): T[] {
  if (!Array.isArray(value)) {
    throw new UnexpectedCommerceResponseError(`${endpoint} did not return an array`);
  }
  return value as T[];
}

/**
 * Lookup data for the Add Customer form and the list's Group/Website columns,
 * from Magento's default REST: customer groups (+ the store's default group),
 * websites and store views.
 */
export async function main(params: CustomerOptionsParams): Promise<AppResponse> {
  initializeLogger("process-function", params.LOG_LEVEL ?? "info");

  try {
    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
      timeoutMs: COMMERCE_TIMEOUT_MS,
    });

    const groupsQuery = buildSearchCriteriaQuery({ pageSize: GROUP_PAGE_SIZE, currentPage: 1 });
    const [groupsResponse, defaultGroup, websites, storeViews] = await Promise.all([
      client.get<{ items?: unknown }>(`/customerGroups/search?${groupsQuery}`),
      client.get<MagentoGroup>("/customerGroups/default"),
      client.get<unknown>("/store/websites"),
      client.get<unknown>("/store/storeViews"),
    ]);

    const groups = requireArray<MagentoGroup>(groupsResponse?.items, "GET /customerGroups/search");

    return successResponse("Customer options", {
      groups: groups
        .filter((group) => group.id !== RESERVED_ID)
        .map((group) => ({ id: group.id, code: group.code }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      defaultGroupId: typeof defaultGroup?.id === "number" ? defaultGroup.id : null,
      websites: requireArray<MagentoWebsite>(websites, "GET /store/websites")
        .filter((website) => website.id !== RESERVED_ID)
        .map((website) => ({ id: website.id, code: website.code, name: website.name })),
      storeViews: requireArray<MagentoStoreView>(storeViews, "GET /store/storeViews")
        .filter((store) => store.id !== RESERVED_ID && store.is_active === 1)
        .map((store) => ({ id: store.id, code: store.code, name: store.name, websiteId: store.website_id })),
    });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Customer options");
  }
}
