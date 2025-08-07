import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { getStateClient } from "../../utils/lib-state/state-client";
import { Customer } from "../types/customer";
import { CustomerGetParams } from "../types/request";

export async function main(params: CustomerGetParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const customerId = params.customerId;

    const stateClient = await getStateClient();
    const entry = await stateClient.get(`customer-${customerId}`);
    const customer = JSON.parse(entry.value) as Customer;

    return successResponse("Customer fetched", { customer });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
