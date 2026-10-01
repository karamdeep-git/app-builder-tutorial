import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, actionSuccessResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { login, setProductStatusAllStores } from "../../utils/adobe-commerce/admin-session-client";
import { getStateClient } from "../../utils/lib-state/state-client";
import { Product, PRODUCT_STATE_TTL_SECONDS, productStateKey } from "../types/product";
import { ProductUpdateParams } from "../types/request";

interface AttributeSet {
  attribute_set_id: number;
  attribute_set_name: string;
}

function isNotFoundError(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

async function fetchExistingProduct(client: AdobeCommerceClient, sku: string): Promise<Product | null> {
  try {
    return await client.get<Product>(`/products/${encodeURIComponent(sku)}`);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

async function getDefaultAttributeSetId(client: AdobeCommerceClient): Promise<number> {
  const result = await client.get<{ items: AttributeSet[] }>(
    "/products/attribute-sets/sets/list?searchCriteria[pageSize]=50&searchCriteria[currentPage]=1"
  );
  const sets = result.items ?? [];
  const defaultSet = sets.find((set) => set.attribute_set_name?.toLowerCase() === "default") ?? sets[0];

  if (!defaultSet) {
    throw new Error("No Commerce attribute set available to create a new product");
  }

  return defaultSet.attribute_set_id;
}

function getCategoryIds(product: Partial<Product> | null | undefined): string[] {
  const attribute = product?.custom_attributes as { attribute_code: string; value: unknown }[] | undefined;
  const categoryIds = attribute?.find((attr) => attr.attribute_code === "category_ids")?.value;
  return Array.isArray(categoryIds) ? categoryIds.map(String) : [];
}

/**
 * Magento's product save silently ignores an empty `category_ids` value in
 * `custom_attributes` (treated as "unset", not "clear all") - a non-empty
 * reduced list works fine, but there's no way to reach zero categories that
 * way. Explicitly unlinking removed categories via the dedicated endpoint
 * works correctly in every case, so removals never rely on that merge at all.
 *
 * Returns the corrected `category_ids` custom_attributes entries to use when
 * caching the saved product, since the PUT response above was captured
 * before these removals ran and would otherwise still show the old list.
 */
async function removeDroppedCategories(
  client: AdobeCommerceClient,
  sku: string,
  existingProduct: Product | null,
  newProduct: Partial<Product>
): Promise<{ attribute_code: string; value: unknown }[] | null> {
  if (!existingProduct || !("custom_attributes" in newProduct)) {
    return null;
  }

  const oldCategoryIds = getCategoryIds(existingProduct);
  const newCategoryIds = getCategoryIds(newProduct);
  const removedCategoryIds = oldCategoryIds.filter((id) => !newCategoryIds.includes(id));

  for (const categoryId of removedCategoryIds) {
    await client.delete(`/categories/${encodeURIComponent(categoryId)}/products/${encodeURIComponent(sku)}`);
  }

  const otherAttributes = ((newProduct.custom_attributes as { attribute_code: string; value: unknown }[]) ?? []).filter(
    (attr) => attr.attribute_code !== "category_ids"
  );
  return [...otherAttributes, { attribute_code: "category_ids", value: newCategoryIds }];
}

/**
 * Best-effort sync of the "All Store Views" scope (store_id 0) for status changes -
 * Magento's REST API can only write the Default Store View scope (see
 * admin-session-client.ts for why), so this drives Magento's own internal Admin
 * mass-update controller instead. Never allowed to fail the overall update: any
 * failure here (bad admin credentials, Magento admin down, form structure changed)
 * is logged and swallowed, since the real, functionally important write already
 * succeeded via the REST API above.
 */
async function syncStatusToAllStoreViews(
  params: ProductUpdateParams,
  savedProduct: Product,
  existingProduct: Product | null,
  newProduct: Partial<Product>
): Promise<void> {
  if (typeof newProduct.status !== "number") {
    return;
  }
  if (existingProduct && existingProduct.status === newProduct.status) {
    return;
  }
  if (!params.COMMERCE_ADMIN_USERNAME || !params.COMMERCE_ADMIN_PASSWORD) {
    return;
  }

  const entityId = savedProduct.id;
  if (typeof entityId !== "number") {
    return;
  }

  const session = await login(params.COMMERCE_BASE_URL, params.COMMERCE_ADMIN_USERNAME, params.COMMERCE_ADMIN_PASSWORD);
  await setProductStatusAllStores(params.COMMERCE_BASE_URL, session, entityId, newProduct.status);
}

export async function main(params: ProductUpdateParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const product = params.data;

    if (!product?.sku) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing sku");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const existingProduct = await fetchExistingProduct(client, product.sku);
    const exists = existingProduct !== null;

    let payload: Partial<Product> = product;
    if (!exists) {
      const attributeSetId = await getDefaultAttributeSetId(client);
      payload = {
        type_id: "simple",
        status: 1,
        visibility: 4,
        attribute_set_id: attributeSetId,
        ...product,
      };
    }

    const savedProduct = (await client.put(`/products/${encodeURIComponent(product.sku)}`, {
      product: payload as Record<string, unknown>,
    })) as Product;

    const correctedCustomAttributes = await removeDroppedCategories(client, product.sku, existingProduct, product);
    const productToCache = correctedCustomAttributes
      ? { ...savedProduct, custom_attributes: correctedCustomAttributes }
      : savedProduct;

    try {
      await syncStatusToAllStoreViews(params, savedProduct, existingProduct, product);
    } catch (syncError: unknown) {
      const syncErrorMessage = syncError instanceof Error ? syncError.message : "Unknown error";
      logError(`Warning: failed to sync status to Magento's All Store Views scope: ${syncErrorMessage}`);
    }

    const stateClient = await getStateClient();
    await stateClient.put(productStateKey(productToCache.sku), JSON.stringify(productToCache), {
      ttl: PRODUCT_STATE_TTL_SECONDS,
    });

    return actionSuccessResponse(exists ? "Product updated" : "Product created");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
