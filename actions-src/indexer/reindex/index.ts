import { initializeLogger } from "../../logger";
import { successResponse } from "../../responses";
import { AppResponse } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { IndexerReindexParams } from "../types/request";

export async function main(params: IndexerReindexParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const jobId = (await client.post("/kinex-reindex/jobs", {
      indexerIds: params.indexerIds ?? [],
    })) as string;

    return successResponse("Job started", { jobId });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Reindex start");
  }
}
