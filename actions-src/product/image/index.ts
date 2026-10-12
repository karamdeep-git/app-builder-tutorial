import axios from "axios";
import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { ProductImageParams } from "../types/request";

// Only simple path segments - blocks "://", "@" and anything else that could
// redirect this fetch away from Magento's own media directory. This action
// only ever appends `path` onto a fixed, server-configured base URL (never
// lets a caller supply a host), so this is defense in depth, not the only
// thing preventing SSRF.
const SAFE_PATH_PATTERN = /^\/[a-zA-Z0-9/_.-]+$/;

// SAFE_PATH_PATTERN allows "." and "/" (real media paths contain both), so it
// can't stop "/../../app/etc/env.php" on its own - URL normalization would
// resolve that outside media/catalog/product. Reject dot segments explicitly.
function hasDotSegment(path: string): boolean {
  return path.split("/").some((segment) => segment === "." || segment === "..");
}

/**
 * Proxies a Magento product image through this action instead of letting the
 * browser load it directly from Magento's `media/catalog/product` URL. A
 * direct <img> load works fine against a real production Commerce domain,
 * but against a free ngrok tunnel (used for local dev in this project).
 * ngrok's own edge serves its browser-warning interstitial page (HTML, not
 * the image) to requests it identifies as coming from a browser, and Chrome
 * then blocks the mismatched content-type as an opaque response
 * (net::ERR_BLOCKED_BY_ORB). This action fetches the image server-side,
 * exactly like every other action in this app already calls Magento - ngrok
 * never flags that traffic as a browser, so the real bytes come back.
 */
export async function main(params: ProductImageParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (!params.path || !SAFE_PATH_PATTERN.test(params.path) || hasDotSegment(params.path)) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing or invalid path");
    }

    const imageUrl = `${params.COMMERCE_BASE_URL}media/catalog/product${params.path}`;
    const response = await axios.get<ArrayBuffer>(imageUrl, { responseType: "arraybuffer", timeout: 8000 });
    const contentType = typeof response.headers["content-type"] === "string" ? response.headers["content-type"] : "image/jpeg";

    return {
      statusCode: HttpStatus.OK,
      headers: {
        "Content-Type": contentType,
        // private: this response sits behind require-adobe-auth, so a shared
        // cache/CDN must never store it and replay it to an unauthenticated caller.
        "Cache-Control": "private, max-age=86400",
      },
      body: Buffer.from(response.data).toString("base64"),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
