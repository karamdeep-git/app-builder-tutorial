// @adobe/aio-lib-state exports MAX_TTL (365 days) at runtime, but its type
// declarations don't expose it, so it's mirrored here for a typed import.
export const PRODUCT_STATE_TTL_SECONDS = 60 * 60 * 24 * 365;

export interface Product {
  sku: string;
  name?: string;
  price?: number;
  status?: number;
  type_id?: string;
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
