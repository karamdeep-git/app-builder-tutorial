import { AppResponse, HttpStatus } from "../types/request";

/**
 * Builds CORS headers that only allow the configured storefront origin, not
 * the wildcard `*` Adobe I/O Runtime applies to web actions by default.
 * The request's Origin header is echoed back only when it matches
 * allowedOrigin exactly - otherwise no Access-Control-Allow-Origin header is
 * sent, so the browser blocks the response from being read by other origins.
 */
export function corsHeaders(allowedOrigin: string | undefined, requestOrigin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return headers;
}

/**
 * Short-circuit response for the CORS preflight OPTIONS request. Requires
 * the action to be deployed with the `web-custom-options: true` annotation,
 * otherwise Adobe I/O Runtime answers OPTIONS itself before the action runs.
 */
export function isPreflightRequest(method: string | undefined): boolean {
  return (method ?? "").toLowerCase() === "options";
}

export function preflightResponse(allowedOrigin: string | undefined, requestOrigin: string | undefined): AppResponse {
  return {
    statusCode: HttpStatus.OK,
    body: "",
    headers: corsHeaders(allowedOrigin, requestOrigin),
  };
}
