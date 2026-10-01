import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { getStateClient } from "../../utils/lib-state/state-client";
import { Product } from "../types/product";

export async function main(): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const stateClient = await getStateClient();

    const products: Product[] = [];
    for await (const { keys } of stateClient.list({ match: `product-*`, countHint: 1000 })) {
      for (const key of keys) {
        const entry = await stateClient.get(key);
        if (entry?.value) {
          products.push(JSON.parse(entry.value) as Product);
        }
      }
    }

    return successResponse("Product list", { products });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
