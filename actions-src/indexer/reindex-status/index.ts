import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { IndexerReindexStatusParams } from "../types/request";

export async function main(params: IndexerReindexStatusParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (!params.jobId) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing jobId");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const raw = await client.get<string>(`/kinex-reindex/jobs/${encodeURIComponent(params.jobId)}`);
    const job = JSON.parse(raw);

    return successResponse("Job status", { job });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
