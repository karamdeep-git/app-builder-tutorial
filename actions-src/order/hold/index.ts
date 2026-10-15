import { initializeLogger } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { OrderHoldParams } from "../types/request";

/**
 * Proxies Magento's default POST /V1/orders/{id}/hold - canHold() rules are
 * enforced server-side by Magento itself; this action surfaces its result.
 */
export async function main(params: OrderHoldParams): Promise<AppResponse> {
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

    const result = await client.post(`/orders/${encodeURIComponent(orderId)}/hold`, {});

    return successResponse("Order held", { orderId, result });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Order hold", "Order not found.");
  }
}
