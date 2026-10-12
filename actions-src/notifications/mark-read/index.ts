import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { getStateClient } from "../../utils/lib-state/state-client";
import { loadNotifications, saveNotifications } from "../types/notification";
import { NotificationsMarkReadParams } from "../types/request";

export async function main(params: NotificationsMarkReadParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (!params.id && !params.all) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing id (or all)");
    }

    const stateClient = await getStateClient();
    const notifications = await loadNotifications(stateClient);

    const updated = notifications.map((n) => (params.all || n.id === params.id ? { ...n, read: true } : n));
    await saveNotifications(stateClient, updated);

    const unreadCount = updated.filter((n) => !n.read).length;
    return successResponse("Notifications updated", { notifications: updated, unreadCount });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
