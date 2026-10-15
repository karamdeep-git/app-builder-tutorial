export interface StoreConfig {
  storeCode: string;
  storeUrl?: string;
  /** Per-request timeout for Commerce calls. Omitted = no timeout (axios default). */
  timeoutMs?: number;
}
