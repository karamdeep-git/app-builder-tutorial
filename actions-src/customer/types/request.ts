import { BaseParams, DataParams } from "../../types/request";
import { Customer } from "./customer";

export type CustomerCreateParams = BaseParams & DataParams<Customer>;

export interface CustomerIdParams {
  customerId: number;
}

export type CustomerGetParams = BaseParams & CustomerIdParams;

export type CustomerListParams = BaseParams;

export type CustomerDeleteParams = BaseParams & CustomerIdParams;
