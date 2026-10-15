import { initializeLogger } from "../../logger";
import { successResponse } from "../../responses";
import { AppResponse } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { IndexerListParams } from "../types/request";

export interface IndexerStatus {
  indexer_id: string;
  title: string;
  status: string;
  scheduled: boolean;
  latest_updated: string | null;
}

export async function main(params: IndexerListParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const indexers = await client.get<IndexerStatus[]>("/kinex-reindex/indexers");

    return successResponse("Indexers", { indexers });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Indexer list");
  }
}
