import { initializeLogger } from "../../logger";
import { successResponse } from "../../responses";
import { AppResponse } from "../../types/request";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
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
    return commerceErrorResponse(error, "Notifications list");
  }
}
