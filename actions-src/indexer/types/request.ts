import { BaseParams } from "../../types/request";
import { CommerceParams } from "../../utils/adobe-commerce/types/request";

export type IndexerListParams = BaseParams & CommerceParams;

export interface IndexerReindexData {
  indexerIds?: string[];
}

export type IndexerReindexParams = BaseParams & CommerceParams & IndexerReindexData;

export interface IndexerReindexStatusQueryParams {
  jobId: string;
}

export type IndexerReindexStatusParams = BaseParams & CommerceParams & IndexerReindexStatusQueryParams;
