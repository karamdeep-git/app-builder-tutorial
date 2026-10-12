import { CommerceParams } from "../../utils/adobe-commerce/types/request";
import { BaseParams } from "../../types/request";

export interface StorefrontStockData {
  sku: string;
}

export type StorefrontStockParams = BaseParams & CommerceParams & StorefrontStockData;
