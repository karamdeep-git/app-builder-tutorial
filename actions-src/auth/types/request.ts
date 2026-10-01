import { BaseParams, DataParams } from "../../types/request";

export interface AdminLoginData {
  username: string;
  password: string;
}

export type AdminLoginParams = BaseParams & { COMMERCE_BASE_URL: string } & DataParams<AdminLoginData>;
