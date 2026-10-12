import { BaseParams } from "../../types/request";

export type NotificationsListParams = BaseParams;

export interface NotificationsMarkReadData {
  id?: string;
  all?: boolean;
}

export type NotificationsMarkReadParams = BaseParams & NotificationsMarkReadData;
