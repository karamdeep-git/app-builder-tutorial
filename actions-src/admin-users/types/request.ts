import { CommerceParams } from "../../utils/adobe-commerce/types/request";
import { BaseParams } from "../../types/request";

export type AdminUserListParams = BaseParams & CommerceParams;

export interface AdminUserBulkActionData {
  userIds: number[];
}

export type AdminUserActivateParams = BaseParams & CommerceParams & AdminUserBulkActionData;
export type AdminUserDeactivateParams = BaseParams & CommerceParams & AdminUserBulkActionData;
