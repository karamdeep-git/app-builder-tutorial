import { initializeLogger } from "../../logger";
import { successResponse } from "../../responses";
import { AppResponse } from "../../types/request";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
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
    return commerceErrorResponse(error, "Product list");
  }
}
