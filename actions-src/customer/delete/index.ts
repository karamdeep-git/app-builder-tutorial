import { initializeLogger } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { COMMERCE_TIMEOUT_MS, CustomerDeleteParams, parseId } from "../types/request";

/**
 * Proxies Magento's default DELETE /V1/customers/{customerId}. Magento keeps
 * the customer's orders (they just stop being linked to an account) - the UI
 * says so in its confirmation dialog.
 */
export async function main(params: CustomerDeleteParams): Promise<AppResponse> {
  initializeLogger("process-function", params.LOG_LEVEL ?? "info");

  try {
    const customerId = parseId(params.customerId);
    if (customerId === null) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing or invalid customerId");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
      timeoutMs: COMMERCE_TIMEOUT_MS,
    });

    await client.delete(`/customers/${customerId}`);

    return successResponse("Customer deleted", { customerId });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Customer delete", "Customer not found. It may already have been deleted.");
  }
}
