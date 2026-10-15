import { initializeLogger, logError, logInfo } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import {
  isOrderNotification,
  loadNotifications,
  MAX_NOTIFICATIONS,
  OrderNotification,
  saveNotifications,
} from "../../notifications/types/notification";
import { getStateClient } from "../../utils/lib-state/state-client";
import { EventCode } from "../../utils/io-events/adobe-events-api";
import { getCustomerName } from "../types/order";
import { OrderEventParams } from "../types/request";

export async function main(params: OrderEventParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (params.type !== EventCode.ORDER_PLACED) {
      logInfo(`Ignoring unsupported event type ${params.type}`);
      return successResponse(params.type ?? "unknown", { success: true, message: "Ignored" });
    }

    const order = params.data?.value?.order;
    if (!order?.increment_id) {
      throw new Error("Missing increment_id in event payload");
    }

    const stateClient = await getStateClient();
    const notifications = await loadNotifications(stateClient);

    // Adobe I/O Events delivery is at-least-once, not exactly-once - a retry
    // must never produce a second notification for the same order.
    if (notifications.some((n) => isOrderNotification(n) && n.incrementId === order.increment_id)) {
      logInfo(`Notification for order ${order.increment_id} already exists, skipping duplicate`);
      return successResponse(params.type, { success: true, message: "Duplicate, ignored" });
    }

    const notification: OrderNotification = {
      id: `order-${order.increment_id}`,
      type: "order",
      incrementId: order.increment_id,
      customerName: getCustomerName({ customer_firstname: order.customer_firstname, customer_lastname: order.customer_lastname }),
      grandTotal: order.grand_total ?? 0,
      currencyCode: order.order_currency_code,
      status: order.status ?? "pending",
      // Magento's event payload never includes created_at for this event
      // (confirmed via Adobe's trace API) - the time this notification was
      // actually created is a close enough approximation.
      createdAt: new Date().toISOString(),
      read: false,
    };

    const updated = [notification, ...notifications].slice(0, MAX_NOTIFICATIONS);
    await saveNotifications(stateClient, updated);

    return successResponse(params.type, { success: true, message: `Notification created for order ${order.increment_id}` });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
