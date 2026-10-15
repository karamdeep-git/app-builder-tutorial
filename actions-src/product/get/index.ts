import { initializeLogger } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { Product } from "../types/product";
import { ProductGetParams } from "../types/request";

export async function main(params: ProductGetParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (!params.sku) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing sku");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    // Fetched live from Magento (not the State cache product/list reads from)
    // since stock is the one field here that changes outside this app too -
    // the Edit dialog needs the real current qty/is_in_stock, not a stale copy.
    const product = await client.get<Product>(`/products/${encodeURIComponent(params.sku)}`);

    return successResponse("Product fetched", { product });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Product get", "Product not found. It may have been deleted.");
  }
}
