import axios from "axios";
import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { corsHeaders, isPreflightRequest, preflightResponse } from "../../utils/cors";
import { StorefrontStockParams } from "../types/request";

// Expected contract of the external stock system (ERP/3PL), read from Magento
// admin config (Stores > Configuration > General > Storefront Stock Widget):
// GET {external_stock_api_url}/stock/{sku}
// Authorization: Bearer {external_stock_api_key}
// -> { "quantity": number, "inStock": boolean }
interface ExternalStockResponse {
  quantity: number;
  inStock: boolean;
}

interface StorefrontStockConfig {
  external_stock_api_url: string;
  external_stock_api_key: string;
  allowed_origin: string;
}

export async function main(params: StorefrontStockParams): Promise<AppResponse> {
  initializeLogger("process-function");

  const requestOrigin = params.__ow_headers?.origin;

  let config: StorefrontStockConfig;
  try {
    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });
    config = await client.get<StorefrontStockConfig>("/kinex-storefront-stock/config");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Failed to load storefront stock config from Magento: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, "Storefront stock widget is not configured");
  }

  const headers = corsHeaders(config.allowed_origin, requestOrigin);

  if (isPreflightRequest(params.__ow_method)) {
    return preflightResponse(config.allowed_origin, requestOrigin);
  }

  try {
    if (!params.sku || typeof params.sku !== "string") {
      return { ...actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing sku"), headers };
    }

    // A hung or unreachable ERP must fail fast, not ride along until Adobe I/O
    // Runtime's own action timeout - that's what left the widget stuck instead
    // of showing "unavailable". axios's own `timeout` option doesn't reliably
    // bound a slow/stuck DNS lookup (confirmed: it still took 58s against a
    // non-existent host), since that timer only covers the phase after a
    // socket exists - an AbortController cuts the request off regardless of
    // which phase (DNS, connect, response) it's stuck in.
    const abortController = new AbortController();
    const abortTimer = setTimeout(() => abortController.abort(), 8000);
    let data: ExternalStockResponse;
    try {
      ({ data } = await axios.get<ExternalStockResponse>(
        `${config.external_stock_api_url}/stock/${encodeURIComponent(params.sku)}`,
        {
          headers: { Authorization: `Bearer ${config.external_stock_api_key}` },
          signal: abortController.signal,
        }
      ));
    } finally {
      clearTimeout(abortTimer);
    }

    return {
      ...successResponse("Stock", {
        sku: params.sku,
        quantity: data.quantity,
        inStock: data.inStock,
      }),
      headers,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return { ...actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`), headers };
  }
}
