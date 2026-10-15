import { initializeLogger } from "../../logger";
import { successResponse } from "../../responses";
import { AppResponse } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { CommandsHistoryParams } from "../types/request";

export async function main(params: CommandsHistoryParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const raw = await client.get<string>("/kinex-commands/history");
    const jobs = JSON.parse(raw);

    return successResponse("History", { jobs });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Command history");
  }
}
