import axios from "axios";
import { main as adminUserDeactivate } from "../actions-src/admin-users/deactivate";
import { main as login } from "../actions-src/auth/login";
import { main as categoryDelete } from "../actions-src/category/delete";
import { main as commandsRun } from "../actions-src/commands/run";
import { main as reindex } from "../actions-src/indexer/reindex";
import { initializeTestLogger } from "../actions-src/logger";
import { main as orderCancel } from "../actions-src/order/cancel";
import { main as productGet } from "../actions-src/product/get";
import { AppResponse } from "../actions-src/types/request";

// One representative action per older package, to prove each now goes through
// commerceErrorResponse (its own mapping is unit-tested in commerce-errors.test.ts)
// instead of the old blanket `500 Request failed: <raw error text>`.

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const commerce = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
};

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  });
}

type Case = [label: string, run: () => Promise<AppResponse>, error: unknown, status: number, message: string];

const cases: Case[] = [
  [
    "order/cancel passes Magento's reason through (400)",
    () => orderCancel({ ...commerce, orderId: "7" }),
    httpError(400, { message: "You can't cancel this order." }),
    400,
    "You can't cancel this order.",
  ],
  [
    "order/cancel reports a missing order (404)",
    () => orderCancel({ ...commerce, orderId: "999" }),
    httpError(404, { message: "The entity that was requested doesn't exist." }),
    404,
    "Order not found.",
  ],
  [
    "product/get reports a deleted product (404)",
    () => productGet({ ...commerce, sku: "MB01" }),
    httpError(404, { message: "The product that was requested doesn't exist." }),
    404,
    "Product not found. It may have been deleted.",
  ],
  [
    "category/delete passes Magento's reason through (400)",
    () => categoryDelete({ ...commerce, categoryId: 2 }),
    httpError(400, { message: 'Cannot delete category with id %1', parameters: ["2"] }),
    400,
    "Cannot delete category with id 2",
  ],
  [
    "indexer/reindex hides a Magento server error (502)",
    () => reindex({ ...commerce }),
    httpError(500, { message: "Internal Error. Details are available in Magento log file.", trace: "#0 ..." }),
    502,
    "Magento returned an error. Try again, or check Magento's logs.",
  ],
  [
    "commands/run hides the integration being rejected (502)",
    () => commandsRun({ ...commerce, commandIds: ["cache:flush"], stopOnFailure: true, triggeredBy: "test" }),
    httpError(401, { message: "The consumer isn't authorized to access %resources." }),
    502,
    "Magento rejected this app's integration credentials.",
  ],
  [
    "admin-users/deactivate passes the 'last active admin' refusal through (400)",
    () => adminUserDeactivate({ ...commerce, userIds: [1] }),
    httpError(400, { message: "At least one admin user must remain active." }),
    400,
    "At least one admin user must remain active.",
  ],
  [
    "a Magento timeout becomes 504 (order/cancel)",
    () => orderCancel({ ...commerce, orderId: "7" }),
    Object.assign(new Error("timeout"), { isAxiosError: true, code: "ECONNABORTED" }),
    504,
    "Magento didn't respond in time. Try again.",
  ],
];

describe("older actions use the shared Commerce error mapping", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it.each(cases)("%s", async (_label, run, error, status, message) => {
    mockAxios.mockRejectedValue(error);

    const result = await run();

    expect(result).toEqual({ statusCode: status, body: { success: false, error: message } });
  });

  it("never echoes raw internal error text (the old `Request failed: ...`)", async () => {
    mockAxios.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.12:443"));

    const result = await productGet({ ...commerce, sku: "MB01" });

    expect(JSON.stringify(result.body)).not.toContain("10.0.0.12");
    expect(result.body).toEqual({ success: false, error: "Unexpected error. Check the action logs." });
  });

  describe("auth/login", () => {
    it("keeps a wrong Magento password as 401 (not the 502 an integration 401 maps to)", async () => {
      mockAxios.mockRejectedValue(httpError(401, { message: "The account sign-in was incorrect." }));

      const result = await login({ COMMERCE_BASE_URL: commerce.COMMERCE_BASE_URL, data: { username: "a", password: "b" } });

      expect(result).toEqual({ statusCode: 401, body: { success: false, error: "Invalid username or password" } });
    });

    it("maps other failures through the shared helper", async () => {
      mockAxios.mockRejectedValue(httpError(503));

      const result = await login({ COMMERCE_BASE_URL: commerce.COMMERCE_BASE_URL, data: { username: "a", password: "b" } });

      expect(result.statusCode).toBe(502);
    });
  });
});
