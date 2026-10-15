import { BaseParams, DataParams } from "../../types/request";
import { CommerceParams } from "../../utils/adobe-commerce/types/request";

export interface CustomerSearchQueryParams {
  query?: string;
  page?: number | string;
  pageSize?: number | string;
}

export type CustomerListParams = BaseParams & CommerceParams & CustomerSearchQueryParams;

export interface CustomerIdParams {
  customerId?: number | string;
}

export type CustomerGetParams = BaseParams & CommerceParams & CustomerIdParams;

export type CustomerDeleteParams = BaseParams & CommerceParams & CustomerIdParams;

// No password field on purpose: Magento emails the new customer a link to set
// their own, so admins never choose or see customer passwords.
export interface CustomerCreateData {
  firstname?: string;
  lastname?: string;
  email?: string;
  websiteId?: number | string;
  groupId?: number | string;
  // Store view the welcome email is sent from.
  storeId?: number | string;
}

export type CustomerCreateParams = BaseParams & CommerceParams & Partial<DataParams<CustomerCreateData>>;

export type CustomerOptionsParams = BaseParams & CommerceParams;

/** Bounds every Commerce call these actions make - a hung Magento must fail fast, not ride the Runtime timeout. */
export const COMMERCE_TIMEOUT_MS = 15000;

/** Positive integer id from a query/body value, or null if it isn't one. */
export function parseId(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return id > 0 && Number.isSafeInteger(id) ? id : null;
}
