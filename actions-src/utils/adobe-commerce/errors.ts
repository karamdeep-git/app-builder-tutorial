import { logError } from "../../logger";
import { actionErrorResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";

/**
 * Thrown by an action when Magento answered 2xx but with a body that isn't the
 * shape the documented endpoint returns (e.g. no `items` array) - mapped to a
 * 502 like any other bad upstream response, instead of crashing on it later.
 */
export class UnexpectedCommerceResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnexpectedCommerceResponseError";
  }
}

interface MagentoErrorBody {
  message?: unknown;
  parameters?: unknown;
}

// Duck-typed rather than axios.isAxiosError(): action tests jest.mock("axios")
// wholesale, which turns isAxiosError into a stub, and this only needs the
// fields axios puts on its errors anyway.
interface HttpLikeError {
  isAxiosError?: boolean;
  code?: string;
  response?: { status?: number; data?: unknown };
}

const TIMEOUT_CODES = ["ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED"];

/**
 * Magento error bodies carry a message template plus its values separately:
 * `{"message": "\"%fieldName\" is required.", "parameters": {"fieldName": "email"}}`
 * or positional `{"message": "%1 isn't valid", "parameters": ["x"]}`.
 * Returns the filled-in message, or undefined if there's no message at all.
 */
export function formatMagentoMessage(body: unknown): string | undefined {
  const { message, parameters } = (body ?? {}) as MagentoErrorBody;
  if (typeof message !== "string" || !message) return undefined;

  if (Array.isArray(parameters)) {
    return message.replace(/%(\d+)/g, (match, index) => {
      const value = parameters[Number(index) - 1];
      return value === undefined ? match : String(value);
    });
  }
  if (parameters && typeof parameters === "object") {
    const named = parameters as Record<string, unknown>;
    return message.replace(/%([a-zA-Z_]\w*)/g, (match, name) => (name in named ? String(named[name]) : match));
  }
  return message;
}

function rawMessageTemplate(body: unknown): string {
  const { message } = (body ?? {}) as MagentoErrorBody;
  return typeof message === "string" ? message : "-";
}

export interface CommerceErrorDescription {
  status: HttpStatus;
  message: string;
}

/**
 * Maps any failure from a Commerce call to a safe status + message, and logs
 * it. The caller gets Magento's own reason only where it's the admin's to act
 * on (validation, not found); credential/permission/server problems on the
 * Magento side get a generic message, never internal detail.
 *
 * The log line carries status, error code and Magento's message *template*
 * (placeholders unfilled), which is enough to diagnose without writing the
 * values - often customer emails/names - into logs.
 */
export function describeCommerceError(
  error: unknown,
  context: string,
  notFoundMessage = "Not found in Magento"
): CommerceErrorDescription {
  if (error instanceof UnexpectedCommerceResponseError) {
    logError(`${context} failed: unexpected Magento response - ${error.message}`);
    return { status: HttpStatus.BAD_GATEWAY, message: "Magento returned an unexpected response." };
  }

  const httpError = (error ?? {}) as HttpLikeError;
  const status = httpError.response?.status;

  if (typeof status === "number") {
    const body = httpError.response?.data;
    logError(`${context} failed: Magento status=${status} message="${rawMessageTemplate(body)}"`);

    if (status === 404) return { status: HttpStatus.NOT_FOUND, message: notFoundMessage };
    if (status === 401) {
      return { status: HttpStatus.BAD_GATEWAY, message: "Magento rejected this app's integration credentials." };
    }
    if (status === 403) {
      return {
        status: HttpStatus.BAD_GATEWAY,
        message: "This app's Magento integration isn't allowed to perform this operation.",
      };
    }
    if (status === 429) {
      return { status: HttpStatus.TOO_MANY_REQUESTS, message: "Magento is rate-limiting requests. Try again shortly." };
    }
    if (status >= 500) {
      return { status: HttpStatus.BAD_GATEWAY, message: "Magento returned an error. Try again, or check Magento's logs." };
    }
    return { status: HttpStatus.BAD_REQUEST, message: formatMagentoMessage(body) ?? "Magento rejected the request." };
  }

  if (httpError.code && TIMEOUT_CODES.includes(httpError.code)) {
    logError(`${context} failed: Magento timed out (code=${httpError.code})`);
    return { status: HttpStatus.GATEWAY_TIMEOUT, message: "Magento didn't respond in time. Try again." };
  }

  if (httpError.isAxiosError) {
    logError(`${context} failed: Magento unreachable (code=${httpError.code ?? "-"})`);
    return { status: HttpStatus.BAD_GATEWAY, message: "Couldn't reach Magento. Check that the store is online." };
  }

  const message = error instanceof Error ? error.message : String(error);
  logError(`${context} failed: unexpected error - ${message}`);
  return { status: HttpStatus.INTERNAL_ERROR, message: "Unexpected error. Check the action logs." };
}

/** describeCommerceError as a ready-to-return action error response. */
export function commerceErrorResponse(error: unknown, context: string, notFoundMessage = "Not found in Magento"): AppResponse {
  const { status, message } = describeCommerceError(error, context, notFoundMessage);
  return actionErrorResponse(status, message);
}
