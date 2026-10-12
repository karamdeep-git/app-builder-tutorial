// @adobe/aio-lib-state exports MAX_TTL (365 days) at runtime, but its type
// declarations don't expose it, so it's mirrored here for a typed import.
export const PRODUCT_STATE_TTL_SECONDS = 60 * 60 * 24 * 365;

export interface StockItem {
  item_id?: number;
  qty?: number;
  is_in_stock?: boolean;
}

export interface Product {
  sku: string;
  name?: string;
  price?: number;
  status?: number;
  type_id?: string;
  custom_attributes?: { attribute_code: string; value: unknown }[];
  extension_attributes?: {
    stock_item?: StockItem;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Adobe I/O State keys must match ^[a-zA-Z0-9-_.]{1,1024}$, but real Commerce SKUs
 * can contain spaces, slashes, etc. Encode the sku so any SKU is a valid key.
 *
 * @param sku - the product SKU
 * @returns a State-safe key for the product
 */
export function productStateKey(sku: string): string {
  const encoded = Buffer.from(sku, "utf8").toString("base64url").replace(/=+$/, "");
  return `product-${encoded}`;
}

/**
 * Resolves a product's list-thumbnail image to its path under Magento's
 * `media/catalog/product` directory, preferring the `thumbnail` custom
 * attribute (Magento's own grid/list-sized image) over the larger
 * `small_image`/`image` ones. Magento leaves an unset image attribute as the
 * literal string "no_selection" rather than omitting it, and stores the path
 * with its own leading slash (e.g. "/m/b/mb01-blue-0.jpg").
 *
 * Returns only the relative path, not a full URL - the browser never loads
 * this path directly (see actions-src/product/image), since a free ngrok
 * tunnel serves its own browser-warning interstitial page instead of the
 * actual image to direct, browser-identified requests.
 */
export function getProductThumbnailPath(product: Pick<Product, "custom_attributes">): string | null {
  const attributes = (product?.custom_attributes as { attribute_code: string; value: unknown }[] | undefined) ?? [];
  const imagePath = ["thumbnail", "small_image", "image"]
    .map((code) => attributes.find((attr) => attr.attribute_code === code)?.value)
    .find((value): value is string => typeof value === "string" && value !== "" && value !== "no_selection");

  return imagePath ?? null;
}
