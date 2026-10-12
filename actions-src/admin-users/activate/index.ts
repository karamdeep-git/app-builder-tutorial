import axios from "axios";
import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, actionSuccessResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { AdminUserActivateParams } from "../types/request";

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && typeof error.response?.data?.message === "string") {
    return error.response.data.message;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

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
    const errorMessage = extractErrorMessage(error);
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, errorMessage);
  }
}
