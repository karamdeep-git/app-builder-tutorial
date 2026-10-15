import { initializeLogger } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { MagentoOrder } from "../types/order";
import { OrderGetParams } from "../types/request";

interface ShipmentTrack {
  track_number?: string;
  carrier_code?: string;
  title?: string;
}

interface Shipment {
  entity_id: number;
  tracks?: ShipmentTrack[];
}

interface ShipmentSearchResponse {
  items: Shipment[];
}

function buildShipmentsByOrderIdQuery(orderId: string): string {
  const prefix = "searchCriteria[filter_groups][0][filters][0]";
  return [
    `${prefix}[field]=order_id`,
    `${prefix}[value]=${encodeURIComponent(orderId)}`,
    `${prefix}[condition_type]=eq`,
  ].join("&");
}

function buildIncrementIdLookupQuery(incrementId: string): string {
  const prefix = "searchCriteria[filter_groups][0][filters][0]";
  return [
    `${prefix}[field]=increment_id`,
    `${prefix}[value]=${encodeURIComponent(incrementId)}`,
    `${prefix}[condition_type]=eq`,
  ].join("&");
}

export async function main(params: OrderGetParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    let orderId = String(params.orderId ?? "").trim();
    const incrementId = String(params.incrementId ?? "").trim();
    if (!orderId && !incrementId) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing orderId or incrementId");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    if (!orderId) {
      // Order notifications only ever carry increment_id (see
      // OrderPlacedEventValue) - resolve the real entity_id first.
      const lookup = await client.get<{ items: MagentoOrder[] }>(`/orders?${buildIncrementIdLookupQuery(incrementId)}`);
      const found = lookup.items?.[0];
      if (!found) {
        return actionErrorResponse(HttpStatus.NOT_FOUND, `No order found with increment ID ${incrementId}`);
      }
      orderId = String(found.entity_id);
    }

    // Tracking numbers live on Shipment entities, not the order itself - a
    // second, parallel call against the default shipments endpoint, filtered
    // to this order, is the only way to surface them without a new module.
    const [order, shipmentsResponse] = await Promise.all([
      client.get<MagentoOrder>(`/orders/${encodeURIComponent(orderId)}`),
      client.get<ShipmentSearchResponse>(`/shipments?${buildShipmentsByOrderIdQuery(orderId)}`),
    ]);

    const tracks = (shipmentsResponse.items ?? []).flatMap((shipment) => shipment.tracks ?? []);

    return successResponse("Order detail", { order, tracks });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Order get", "Order not found.");
  }
}
