import { initializeLogger } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse, UnexpectedCommerceResponseError } from "../../utils/adobe-commerce/errors";
import { MagentoCustomer, toCustomerDetail } from "../types/customer";
import { COMMERCE_TIMEOUT_MS, CustomerGetParams, parseId } from "../types/request";

/** Proxies Magento's default GET /V1/customers/{customerId}. */
export async function main(params: CustomerGetParams): Promise<AppResponse> {
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

    const customer = await client.get<MagentoCustomer>(`/customers/${customerId}`);
    if (typeof customer?.id !== "number") {
      throw new UnexpectedCommerceResponseError("GET /customers/{id} returned no customer id");
    }

    return successResponse("Customer", { customer: toCustomerDetail(customer) });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Customer get", "Customer not found. It may have been deleted.");
  }
}
