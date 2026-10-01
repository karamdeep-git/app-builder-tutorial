import { BaseParams } from "../../types/request";
import { CommerceParams } from "../../utils/adobe-commerce/types/request";

export type CategoryListParams = BaseParams & CommerceParams;

export interface CategoryCreateData {
  name: string;
  parentId: number;
  isActive?: boolean;
  isAnchor?: boolean;
}

export type CategoryCreateParams = BaseParams & CommerceParams & CategoryCreateData;

export interface CategoryUpdateData {
  categoryId: number;
  name?: string;
  isActive?: boolean;
  isAnchor?: boolean;
}

export type CategoryUpdateParams = BaseParams & CommerceParams & CategoryUpdateData;

export interface CategoryIdParams {
  categoryId: number;
}

export type CategoryDeleteParams = BaseParams & CommerceParams & CategoryIdParams;

export type CategoryGetParams = BaseParams & CommerceParams & CategoryIdParams;
