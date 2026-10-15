import { initializeLogger } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { describeCommerceError, UnexpectedCommerceResponseError } from "../../utils/adobe-commerce/errors";
import { buildSearchCriteriaQuery, SearchFilter } from "../../utils/adobe-commerce/search-criteria";
import { DashboardStatsParams } from "../types/request";

const COMMERCE_TIMEOUT_MS = 15000;
// Today's orders are summed client-side (Magento's REST has no aggregate
// endpoint), so page through them - but bounded: past this, `partial` is set.
const TODAY_PAGE_SIZE = 300;
const TODAY_MAX_PAGES = 10;

interface MagentoStoreConfig {
  id?: number;
  code?: string;
  timezone?: string;
  base_currency_code?: string;
}

interface MagentoCount {
  total_count?: number;
}

interface MagentoTodayOrders extends MagentoCount {
  items?: { base_grand_total?: number; state?: string }[];
}

interface StoreSettings {
  timezone: string;
  currency: string;
}

interface TodayStats {
  orders: number;
  // base currency, excludes canceled orders
  sales: number;
  // more orders today than this action pages through (sales then undercounts)
  partial: boolean;
}

type SectionKey = "today" | "orders" | "customers" | "products" | "admins";

function toMagentoDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Midnight today in the store's timezone, as the UTC "YYYY-MM-DD HH:mm:ss"
 * Magento stores created_at in. Uses the timezone's offset *now*, so on the
 * two DST-change days a year "today" can start an hour early or late.
 */
export function startOfTodayUtc(now: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  const wallClockAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMs = wallClockAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return toMagentoDate(new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offsetMs));
}

/** searchCriteria asking only for the match count - `fields` keeps Magento from serializing any records. */
function countQuery(filterGroups: SearchFilter[][] = []): string {
  return `${buildSearchCriteriaQuery({ filterGroups, pageSize: 1, currentPage: 1 })}&fields=total_count`;
}

function requireCount(response: MagentoCount | undefined, endpoint: string): number {
  if (typeof response?.total_count !== "number") {
    throw new UnexpectedCommerceResponseError(`${endpoint} returned no total_count`);
  }
  return response.total_count;
}

async function loadStoreSettings(client: AdobeCommerceClient): Promise<StoreSettings> {
  const configs = await client.get<MagentoStoreConfig[]>("/store/storeConfigs");
  if (!Array.isArray(configs)) {
    throw new UnexpectedCommerceResponseError("GET /store/storeConfigs did not return an array");
  }
  const store = configs.find((config) => config.code === "default") ?? configs.find((config) => config.id !== 0);
  return { timezone: store?.timezone || "UTC", currency: store?.base_currency_code || "USD" };
}

async function loadTodayStats(client: AdobeCommerceClient, timezone: string): Promise<TodayStats> {
  const since: SearchFilter[][] = [
    [{ field: "created_at", value: startOfTodayUtc(new Date(), timezone), conditionType: "gteq" }],
  ];
  const fields = encodeURIComponent("items[base_grand_total,state],total_count");

  let orders = 0;
  let sales = 0;
  let fetched = 0;
  for (let page = 1; page <= TODAY_MAX_PAGES; page++) {
    const query = buildSearchCriteriaQuery({ filterGroups: since, pageSize: TODAY_PAGE_SIZE, currentPage: page });
    const response = await client.get<MagentoTodayOrders>(`/orders?${query}&fields=${fields}`);
    orders = requireCount(response, "GET /orders");
    const items = response.items ?? [];

    for (const order of items) {
      if (order.state !== "canceled") sales += Number(order.base_grand_total) || 0;
    }
    fetched += items.length;
    if (fetched >= orders || items.length < TODAY_PAGE_SIZE) break;
  }

  return { orders, sales: Math.round(sales * 100) / 100, partial: fetched < orders };
}

async function loadAdminCounts(client: AdobeCommerceClient): Promise<{ active: number; total: number }> {
  const users = await client.get<{ active?: boolean }[]>("/kinex-admin-users");
  if (!Array.isArray(users)) {
    throw new UnexpectedCommerceResponseError("GET /kinex-admin-users did not return an array");
  }
  return { active: users.filter((user) => user.active === true).length, total: users.length };
}

/**
 * Headline numbers for the Dashboard, all from Magento's default REST API
 * except active admins (Magento has no admin-user REST API at all - that one
 * comes from Kinex_ZLF31QCAN, which reads Magento's native is_active).
 *
 * Sections load independently: one failing (e.g. a timeout) comes back as
 * null plus a reason in `errors`, and the rest still render. Only when every
 * section fails does the action itself return an error status.
 */
export async function main(params: DashboardStatsParams): Promise<AppResponse> {
  initializeLogger("process-function", params.LOG_LEVEL ?? "info");

  const client = AdobeCommerceClient.create(params, {
    storeCode: "default",
    storeUrl: params.COMMERCE_BASE_URL,
    timeoutMs: COMMERCE_TIMEOUT_MS,
  });

  const [store, ordersTotal, customersTotal, productsEnabled, admins] = await Promise.allSettled([
    loadStoreSettings(client),
    client.get<MagentoCount>(`/orders?${countQuery()}`).then((r) => requireCount(r, "GET /orders")),
    client.get<MagentoCount>(`/customers/search?${countQuery()}`).then((r) => requireCount(r, "GET /customers/search")),
    client
      .get<MagentoCount>(`/products?${countQuery([[{ field: "status", value: "1", conditionType: "eq" }]])}`)
      .then((r) => requireCount(r, "GET /products")),
    loadAdminCounts(client),
  ]);

  // "Today" needs the store's timezone; without it, today's numbers would be
  // silently off by the UTC offset, so that section fails with the same reason.
  const today: PromiseSettledResult<TodayStats> =
    store.status === "fulfilled"
      ? await Promise.allSettled([loadTodayStats(client, store.value.timezone)]).then(([result]) => result)
      : store;

  const errors: Partial<Record<SectionKey, string>> = {};
  const failures: HttpStatus[] = [];
  function section<T>(key: SectionKey, result: PromiseSettledResult<T>, notFound?: string): T | null {
    if (result.status === "fulfilled") return result.value;
    const { status, message } = describeCommerceError(result.reason, `Dashboard ${key}`, notFound);
    errors[key] = message;
    failures.push(status);
    return null;
  }

  const stats = {
    today: section("today", today),
    orders: section("orders", ordersTotal),
    customers: section("customers", customersTotal),
    products: section("products", productsEnabled),
    admins: section("admins", admins, "Admin user API not found - is Kinex_ZLF31QCAN installed?"),
  };

  if (failures.length === Object.keys(stats).length) {
    return actionErrorResponse(failures[0], errors.orders ?? Object.values(errors)[0] ?? "Dashboard unavailable");
  }

  return successResponse("Dashboard stats", {
    generatedAt: new Date().toISOString(),
    timezone: store.status === "fulfilled" ? store.value.timezone : null,
    currency: store.status === "fulfilled" ? store.value.currency : null,
    today: stats.today,
    orders: stats.orders === null ? null : { total: stats.orders },
    customers: stats.customers === null ? null : { total: stats.customers },
    products: stats.products === null ? null : { enabled: stats.products },
    admins: stats.admins,
    errors,
  });
}
