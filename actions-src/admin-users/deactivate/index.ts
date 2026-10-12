import axios from "axios";
import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, actionSuccessResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { AdminUserDeactivateParams } from "../types/request";

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && typeof error.response?.data?.message === "string") {
    return error.response.data.message;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

function extractErrorStatus(error: unknown): HttpStatus {
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    return HttpStatus.BAD_REQUEST;
  }
  return HttpStatus.INTERNAL_ERROR;
}

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
    // returns a 400 with a human-readable message - surfaced as-is below.
    await client.post("/kinex-admin-users/deactivate", { userIds: params.userIds });

    return actionSuccessResponse("Admin user(s) deactivated");
  } catch (error: unknown) {
    const errorMessage = extractErrorMessage(error);
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(extractErrorStatus(error), errorMessage);
  }
}
