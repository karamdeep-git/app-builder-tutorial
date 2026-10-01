import { BaseParams, DataParams } from "../../types/request";
import { CommerceParams } from "../../utils/adobe-commerce/types/request";
import { Product } from "./product";

export interface ProductSkuParams {
  sku: string;
}

export type ProductListParams = BaseParams;

export type ProductGetParams = BaseParams & ProductSkuParams;

export type ProductDeleteParams = BaseParams & CommerceParams & ProductSkuParams;

export interface AdminSyncParams {
  COMMERCE_ADMIN_USERNAME?: string;
  COMMERCE_ADMIN_PASSWORD?: string;
}

export type ProductUpdateParams = BaseParams & CommerceParams & DataParams<Product> & AdminSyncParams;

/**
 * Adobe I/O Events flattens the CloudEvent's top-level fields directly into
 * the consumer action's params, so `type` arrives alongside the usual
 * BaseParams fields. Adobe Commerce wraps the actual entity payload one level
 * deeper, under `data.value`, not `data` itself.
 */
export type ProductEventParams = BaseParams & {
  type: string;
  data: {
    value: Partial<Product> & { sku: string };
  };
};

export interface ProductSearchQueryParams {
  query: string;
  page?: number;
  pageSize?: number;
}

export type ProductSearchParams = BaseParams & CommerceParams & ProductSearchQueryParams;

export type ProductCategoriesParams = BaseParams & CommerceParams;
