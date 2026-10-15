import { initializeLogger, logInfo } from "../../logger";
import {
  isSameLowStockAlert,
  loadNotifications,
  LowStockNotification,
  LowStockProduct,
  MAX_LOW_STOCK_PRODUCTS_PER_NOTIFICATION,
  MAX_NOTIFICATIONS,
  saveNotifications,
} from "../../notifications/types/notification";
import { successResponse } from "../../responses";
import { AppResponse } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse, UnexpectedCommerceResponseError } from "../../utils/adobe-commerce/errors";
import { buildSearchCriteriaQuery } from "../../utils/adobe-commerce/search-criteria";
import { getStateClient } from "../../utils/lib-state/state-client";
import { LowStockCheckParams } from "../types/request";

const DEFAULT_THRESHOLD = 5;
const COMMERCE_TIMEOUT_MS = 15000;
// Far above this store's catalog; a bigger catalog would need paging here.
const MAX_ITEMS_PER_RUN = 200;

// SKU -> qty when last alerted. Lets each product alert once when it first
// drops low, and again only after it's been restocked and drops again.
const ALERTED_STATE_KEY = "low-stock-alerted";
// Rewritten every run, so this only lapses if the schedule stops for a week.
const ALERTED_STATE_TTL_SECONDS = 60 * 60 * 24 * 7;

// Product types that hold their own stock. Configurable/bundle/grouped
// parents always report qty 0 in the stock table, which isn't "low stock".
const STOCKED_TYPES = ["simple", "virtual", "downloadable", "giftcard"];
const STATUS_ENABLED = 1;

interface MagentoStockItem {
  product_id: number;
  qty: number;
  manage_stock?: boolean | number;
}

interface MagentoProduct {
  id: number;
  sku: string;
  name?: string;
  type_id: string;
  status?: number;
}

function parseThreshold(value: unknown): number {
  const threshold = Number(value);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_THRESHOLD;
}

/**
 * Scheduled, non-web action (no public URL - run by the alarms trigger in
 * app.config.yaml, or manually with `aio rt action invoke`). Finds products at
 * or below LOW_STOCK_THRESHOLD via Magento's default REST API and posts one
 * low_stock notification to the app's bell for products that newly dropped low.
 */
export async function main(params: LowStockCheckParams): Promise<AppResponse> {
  initializeLogger("process-function", params.LOG_LEVEL ?? "info");

  try {
    const threshold = parseThreshold(params.LOW_STOCK_THRESHOLD);
    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
      timeoutMs: COMMERCE_TIMEOUT_MS,
    });

    // GET /V1/stockItems/lowStock (StockRegistryInterface::getLowStockItems)
    // filters on qty <= threshold only - no product type, status or
    // manage_stock filtering, so that's done below.
    const lowStock = await client.get<{ items?: MagentoStockItem[]; total_count?: number }>(
      `/stockItems/lowStock?scopeId=0&qty=${threshold}&currentPage=1&pageSize=${MAX_ITEMS_PER_RUN}`
    );
    if (!Array.isArray(lowStock?.items)) {
      throw new UnexpectedCommerceResponseError("GET /stockItems/lowStock returned no items array");
    }
    if ((lowStock.total_count ?? 0) > MAX_ITEMS_PER_RUN) {
      logInfo(`Low-stock check: ${lowStock.total_count} items found, only the first ${MAX_ITEMS_PER_RUN} were checked`);
    }

    // manage_stock comes back already resolved against the store config.
    const trackedItems = lowStock.items.filter((item) => item.manage_stock !== false && item.manage_stock !== 0);
    const lowProducts = await loadStockedProducts(client, trackedItems);

    const stateClient = await getStateClient();
    const alertedEntry = await stateClient.get(ALERTED_STATE_KEY);
    const alerted: Record<string, number> = alertedEntry?.value ? JSON.parse(alertedEntry.value) : {};

    const newlyLow = lowProducts.filter((product) => !(product.sku in alerted));

    let notified = false;
    if (newlyLow.length > 0) {
      const now = Date.now();
      const notification: LowStockNotification = {
        id: `low-stock-${now}`,
        type: "low_stock",
        products: newlyLow.slice(0, MAX_LOW_STOCK_PRODUCTS_PER_NOTIFICATION),
        totalCount: newlyLow.length,
        threshold,
        createdAt: new Date(now).toISOString(),
        read: false,
      };
      const notifications = await loadNotifications(stateClient);
      // Two overlapping runs (e.g. a manual `aio rt action invoke` while the
      // schedule fires - the alarms trigger also fires right after every
      // deploy) can both read the alerted state before either saves it.
      // lib-state has no compare-and-set to prevent that, so the run that
      // posts second recognizes the first run's identical alert and skips it.
      const isDuplicate = notifications.some(
        (existing) => existing.type === "low_stock" && isSameLowStockAlert(existing, notification)
      );
      if (isDuplicate) {
        logInfo("Low-stock check: an overlapping run already posted this alert, not posting it again");
      } else {
        await saveNotifications(stateClient, [notification, ...notifications].slice(0, MAX_NOTIFICATIONS));
        notified = true;
      }
    }

    // Saved after the notification on purpose: if this write fails, the worst
    // case is a repeated alert next run - never a silently missed one.
    // Restocked products drop out here, so they can alert again later.
    const nextAlerted = Object.fromEntries(lowProducts.map((product) => [product.sku, product.qty]));
    await stateClient.put(ALERTED_STATE_KEY, JSON.stringify(nextAlerted), { ttl: ALERTED_STATE_TTL_SECONDS });

    const summary = {
      threshold,
      lowStockCount: lowProducts.length,
      newlyLowCount: newlyLow.length,
      notified,
      newlyLowSkus: newlyLow.map((product) => product.sku),
    };
    logInfo(`Low-stock check: ${JSON.stringify(summary)}`);
    return successResponse("Low-stock check", summary);
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Low-stock check");
  }
}

async function loadStockedProducts(
  client: AdobeCommerceClient,
  items: MagentoStockItem[]
): Promise<LowStockProduct[]> {
  if (items.length === 0) return [];

  const query = buildSearchCriteriaQuery({
    filterGroups: [[{ field: "entity_id", value: items.map((item) => item.product_id).join(","), conditionType: "in" }]],
    pageSize: items.length,
    currentPage: 1,
  });
  const response = await client.get<{ items?: MagentoProduct[] }>(`/products?${query}`);
  if (!Array.isArray(response?.items)) {
    throw new UnexpectedCommerceResponseError("GET /products returned no items array");
  }

  const productsById = new Map(response.items.map((product) => [product.id, product]));
  return items.flatMap((item) => {
    const product = productsById.get(item.product_id);
    if (!product || !STOCKED_TYPES.includes(product.type_id) || product.status !== STATUS_ENABLED) return [];
    return [{ sku: product.sku, name: product.name ?? product.sku, qty: item.qty }];
  });
}
