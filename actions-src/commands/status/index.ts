import { initializeLogger } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { CommandsStatusParams } from "../types/request";

export async function main(params: CommandsStatusParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (!params.jobId) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing jobId");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const raw = await client.get<string>(`/kinex-commands/status/${encodeURIComponent(params.jobId)}`);
    const job = JSON.parse(raw);

    return successResponse("Job status", { job });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Command status", "Command job not found. It may have expired.");
  }
}
