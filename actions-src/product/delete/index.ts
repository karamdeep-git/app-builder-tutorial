import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, actionSuccessResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { getStateClient } from "../../utils/lib-state/state-client";
import { productStateKey } from "../types/product";
import { ProductDeleteParams } from "../types/request";

function isNotFoundError(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

export async function main(params: ProductDeleteParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    try {
      await client.delete(`/products/${encodeURIComponent(params.sku)}`);
    } catch (error: unknown) {
      // Already gone from Commerce - deleting is idempotent, not an error.
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    const stateClient = await getStateClient();
    await stateClient.delete(productStateKey(params.sku));

    return actionSuccessResponse("Product deleted");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
