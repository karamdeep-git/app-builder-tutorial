export interface BaseParams {
  __ow_headers?: Record<string, string>;
  __ow_body?: string;
  LOG_LEVEL?: string;
  [key: string]: unknown;
}

export interface DataParams<T> {
  data: T;
}

export interface AdobeAuthParams extends AdobeImsParams {
  OAUTH_TECHNICAL_ACCOUNT_ID: string;
  OAUTH_TECHNICAL_ACCOUNT_EMAIL: string;
  IO_MANAGEMENT_BASE_URL: string;
  IO_CONSUMER_ID: string;
  IO_PROJECT_ID: string;
  IO_WORKSPACE_ID: string;
  OAUTH_ORG_ID: string;
  AIO_runtime_namespace: string;
}

export interface AdobeImsParams {
  COMMERCE_BASE_URL: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET: string;
  OAUTH_SCOPES?: string[];
  OAUTH_HOST?: string;
}

export enum HttpStatus {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  INTERNAL_ERROR = 500,
}

export interface AppResponse {
  statusCode: HttpStatus;
  body: unknown;
}
