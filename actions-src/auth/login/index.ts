import axios from "axios";
import { initializeLogger } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { commerceErrorResponse, UnexpectedCommerceResponseError } from "../../utils/adobe-commerce/errors";
import { AdminLoginParams } from "../types/request";

function isUnauthorized(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 401;
}

export async function main(params: AdminLoginParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const { username, password } = params.data ?? ({} as AdminLoginParams["data"]);

    if (!username || !password) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing username or password");
    }

    const response = await axios({
      url: `${params.COMMERCE_BASE_URL}rest/V1/integration/admin/token`,
      method: "POST",
      data: { username, password },
      responseType: "json",
    });

    // Magento issuing a token is the proof the credentials are valid - the token
    // itself never leaves this action. It's a full admin API key for the store,
    // and the app only needs to know *who* logged in.
    if (typeof response.data !== "string" || !response.data) {
      throw new UnexpectedCommerceResponseError("POST /integration/admin/token returned no token");
    }
    return successResponse("Login successful", { username });
  } catch (error: unknown) {
    // Checked first on purpose: here a 401 is the admin's own wrong
    // credentials, not this app's integration being rejected - which is what
    // commerceErrorResponse (502) assumes a Magento 401 means everywhere else.
    if (isUnauthorized(error)) {
      return actionErrorResponse(HttpStatus.UNAUTHORIZED, "Invalid username or password");
    }
    return commerceErrorResponse(error, "Admin login");
  }
}
