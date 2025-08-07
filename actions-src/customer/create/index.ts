import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, actionSuccessResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { getStateClient } from "../../utils/lib-state/state-client";
import { CustomerCreateParams } from "../types/request";

export async function main(params: CustomerCreateParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const customer = params.data;

    const stateClient = await getStateClient();
    await stateClient.put(`customer-${customer.id}`, JSON.stringify(customer));

    return actionSuccessResponse("Customer created");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
