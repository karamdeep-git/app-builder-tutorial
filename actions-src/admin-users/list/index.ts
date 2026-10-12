import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { AdminUserListParams } from "../types/request";

interface MagentoAdminUserStatus {
  user_id: number;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  active: boolean;
}

export async function main(params: AdminUserListParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const users = await client.get<MagentoAdminUserStatus[]>("/kinex-admin-users");

    return successResponse("Admin users", {
      users: users.map((user) => ({
        id: user.user_id,
        username: user.username,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        isActive: user.active,
      })),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
