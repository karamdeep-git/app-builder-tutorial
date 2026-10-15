import { initializeLogger } from "../../logger";
import { actionErrorResponse, actionSuccessResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { AdminUserActivateParams } from "../types/request";

export async function main(params: AdminUserActivateParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (!Array.isArray(params.userIds) || params.userIds.length === 0) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing userIds");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    await client.post("/kinex-admin-users/activate", { userIds: params.userIds });

    return actionSuccessResponse("Admin user(s) activated");
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Admin user activate", "Admin user not found.");
  }
}
