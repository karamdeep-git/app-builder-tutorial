import axios from "axios";
import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
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

    return successResponse("Login successful", { username, token: response.data });
  } catch (error: unknown) {
    if (isUnauthorized(error)) {
      return actionErrorResponse(HttpStatus.UNAUTHORIZED, "Invalid username or password");
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
