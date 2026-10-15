import { BaseParams } from "../../types/request";
import { CommerceParams } from "../../utils/adobe-commerce/types/request";

export interface LowStockCheckInputs {
  // From actions.config.yaml inputs - a number there, but tolerate a string
  // (e.g. if it's ever moved to a $VAR from .env).
  LOW_STOCK_THRESHOLD?: number | string;
}

export type LowStockCheckParams = BaseParams & CommerceParams & LowStockCheckInputs;
