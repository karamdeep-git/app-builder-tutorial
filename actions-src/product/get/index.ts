import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { getStateClient } from "../../utils/lib-state/state-client";
import { Product, productStateKey } from "../types/product";
import { ProductGetParams } from "../types/request";

export async function main(params: ProductGetParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const stateClient = await getStateClient();
    const entry = await stateClient.get(productStateKey(params.sku));

    if (!entry?.value) {
      return actionErrorResponse(HttpStatus.NOT_FOUND, `Product '${params.sku}' not found`);
    }

    const product = JSON.parse(entry.value) as Product;
    return successResponse("Product fetched", { product });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
