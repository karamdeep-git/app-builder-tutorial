import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, actionSuccessResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { getStateClient } from "../../utils/lib-state/state-client";
import { CustomerDeleteParams } from "../types/request";

export async function main(params: CustomerDeleteParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const customerId = params.customerId;
    const stateClient = await getStateClient();
    
    await stateClient.delete(`customer-${customerId}`);
    // await stateClient.deleteAll({ match: `customer*` });

    return actionSuccessResponse("Customer deleted");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
