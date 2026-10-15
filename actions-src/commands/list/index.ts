import { initializeLogger } from "../../logger";
import { successResponse } from "../../responses";
import { AppResponse } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { CommandsListParams } from "../types/request";

export interface CommandOption {
  id: string;
  label: string;
}

export async function main(params: CommandsListParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const commands = await client.get<CommandOption[]>("/kinex-commands/list");

    return successResponse("Commands", { commands });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Command list");
  }
}
