import { initializeLogger } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse, UnexpectedCommerceResponseError } from "../../utils/adobe-commerce/errors";
import { MagentoCustomer, toCustomerListItem } from "../types/customer";
import { COMMERCE_TIMEOUT_MS, CustomerCreateParams, parseId } from "../types/request";

const MAX_NAME_LENGTH = 255;
// RFC 5321 caps a full address at 254 characters.
const MAX_EMAIL_LENGTH = 254;
// Deliberately loose - Magento does the authoritative email validation and its
// message comes back to the admin as a 400. This only catches obvious typos
// before spending a round-trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Proxies Magento's default POST /V1/customers (AccountManagementInterface::
 * createAccount). No password is sent, so Magento emails the customer a link
 * to set their own. Setting group_id is only allowed for admin-authorized
 * callers (Magento\Customer\Model\AccountManagementApi), which this app's
 * integration is.
 */
export async function main(params: CustomerCreateParams): Promise<AppResponse> {
  initializeLogger("process-function", params.LOG_LEVEL ?? "info");

  try {
    const data = params.data ?? {};
    const firstname = cleanName(data.firstname);
    const lastname = cleanName(data.lastname);
    const email = typeof data.email === "string" ? data.email.trim() : "";

    if (!firstname || !lastname) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "First name and last name are required");
    }
    if (firstname.length > MAX_NAME_LENGTH || lastname.length > MAX_NAME_LENGTH) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, `Names can be at most ${MAX_NAME_LENGTH} characters`);
    }
    if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "A valid email address is required");
    }

    const optionalIds: Record<string, number> = {};
    for (const [field, magentoField] of [
      ["websiteId", "website_id"],
      ["groupId", "group_id"],
      ["storeId", "store_id"],
    ] as const) {
      const raw = data[field];
      if (raw === undefined || raw === null || raw === "") continue;
      const id = parseId(raw);
      if (id === null) {
        return actionErrorResponse(HttpStatus.BAD_REQUEST, `Invalid ${field}`);
      }
      optionalIds[magentoField] = id;
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
      timeoutMs: COMMERCE_TIMEOUT_MS,
    });

    const created = (await client.post("/customers", {
      customer: { email, firstname, lastname, ...optionalIds },
    })) as MagentoCustomer;

    if (typeof created?.id !== "number") {
      throw new UnexpectedCommerceResponseError("POST /customers returned no customer id");
    }

    return successResponse("Customer created", { customer: toCustomerListItem(created) });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Customer create");
  }
}
