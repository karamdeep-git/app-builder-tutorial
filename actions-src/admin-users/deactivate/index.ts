import { initializeLogger } from "../../logger";
import { actionErrorResponse, actionSuccessResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { AdminUserDeactivateParams } from "../types/request";

export async function main(params: AdminUserDeactivateParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (!Array.isArray(params.userIds) || params.userIds.length === 0) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing userIds");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    // Magento itself refuses a request that would leave zero active admin
    // users (Kinex\ZLF31QCAN\Model\AdminUserManagement::deactivate) and
    // returns a 400 with a human-readable message - commerceErrorResponse
    // passes that through to the admin as a 400.
    await client.post("/kinex-admin-users/deactivate", { userIds: params.userIds });

    return actionSuccessResponse("Admin user(s) deactivated");
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Admin user deactivate", "Admin user not found.");
  }
}
