import { initializeLogger, logError, logInfo } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { EventCode } from "../../utils/io-events/adobe-events-api";
import { getStateClient } from "../../utils/lib-state/state-client";
import { PRODUCT_STATE_TTL_SECONDS, productStateKey } from "../types/product";
import { ProductEventParams } from "../types/request";

export async function main(params: ProductEventParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const product = params.data?.value;
    const sku = product?.sku;

    if (!sku) {
      throw new Error("Missing sku in event payload");
    }

    const stateClient = await getStateClient();

    switch (params.type) {
      case EventCode.PRODUCT_SAVED:
        await stateClient.put(productStateKey(sku), JSON.stringify(product), {
          ttl: PRODUCT_STATE_TTL_SECONDS,
        });
        return successResponse(params.type, { success: true, message: `Product ${sku} synced` });

      case EventCode.PRODUCT_DELETED:
        await stateClient.delete(productStateKey(sku));
        return successResponse(params.type, { success: true, message: `Product ${sku} removed` });

      default:
        logInfo(`Ignoring unsupported event type ${params.type}`);
        return successResponse(params.type ?? "unknown", { success: true, message: "Ignored" });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
