import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { getStateClient } from "../../utils/lib-state/state-client";

export async function main(): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const stateClient = await getStateClient();

    const customers = new Map<string, string>();

    for await (const { keys } of stateClient.list({ match: `customer-*`, countHint: 1000 })) {
      for (const key of keys) {
        customers.set(key, (await stateClient.get(key)).value);
      }
    }

    return successResponse("Customer list", {
      customers: Array.from(customers.entries()),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
