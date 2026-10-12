import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { OrderCancelParams } from "../types/request";

/**
 * Proxies Magento's default POST /V1/orders/{id}/cancel - the order's own
 * canCancel() rules (no invoice, not already canceled/complete/closed, etc.)
 * are enforced server-side by Magento itself; this action does not duplicate
 * that logic, it just surfaces whatever Magento decides.
 */
export async function main(params: OrderCancelParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const orderId = String(params.orderId ?? "").trim();
    if (!orderId) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing orderId");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const result = await client.post(`/orders/${encodeURIComponent(orderId)}/cancel`, {});

    return successResponse("Order canceled", { orderId, result });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
