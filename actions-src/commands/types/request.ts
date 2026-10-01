import { BaseParams } from "../../types/request";
import { CommerceParams } from "../../utils/adobe-commerce/types/request";

export type CommandsListParams = BaseParams & CommerceParams;

export interface CommandsRunData {
  commandIds: string[];
  stopOnFailure: boolean;
  triggeredBy: string;
}

export type CommandsRunParams = BaseParams & CommerceParams & CommandsRunData;

export interface CommandsStatusQueryParams {
  jobId: string;
}

export type CommandsStatusParams = BaseParams & CommerceParams & CommandsStatusQueryParams;

export type CommandsHistoryParams = BaseParams & CommerceParams;
