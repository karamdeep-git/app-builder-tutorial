import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { CommandsRunParams } from "../types/request";

export async function main(params: CommandsRunParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (!Array.isArray(params.commandIds) || params.commandIds.length === 0) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing commandIds");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const jobId = (await client.post("/kinex-commands/run", {
      commandIds: params.commandIds,
      stopOnFailure: params.stopOnFailure ?? true,
      triggeredBy: params.triggeredBy ?? "unknown",
    })) as string;

    return successResponse("Job started", { jobId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
