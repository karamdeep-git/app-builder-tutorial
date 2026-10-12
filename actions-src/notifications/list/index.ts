import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { getStateClient } from "../../utils/lib-state/state-client";
import { loadNotifications } from "../types/notification";
import { NotificationsListParams } from "../types/request";

export async function main(params: NotificationsListParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const stateClient = await getStateClient();
    const notifications = await loadNotifications(stateClient);
    const unreadCount = notifications.filter((n) => !n.read).length;

    return successResponse("Notifications", { notifications, unreadCount });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
