import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/customer/delete";
import { CustomerDeleteParams } from "../actions-src/customer/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: CustomerDeleteParams = {
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

describe("customer delete action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("deletes via DELETE /V1/customers/{id}", async () => {
    mockAxios.mockResolvedValue({ data: true });

    const result = await main({ ...baseParams, customerId: "7" });

    const config = (mockAxios.mock.calls as unknown as { url: string; method: string }[][])[0][0];
    expect(config.method).toBe("DELETE");
    expect(config.url).toBe("https://commerce.example.com/rest/V1/customers/7");
    expect(result).toEqual({ statusCode: 200, body: { type: "Customer deleted", response: { customerId: 7 } } });
  });

  it.each([undefined, "", "abc", "0", "../1"])("rejects customerId %p without calling Magento", async (customerId) => {
    const result = await main({ ...baseParams, customerId });

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns 404 when the customer no longer exists", async () => {
    mockAxios.mockRejectedValue(httpError(404, { message: "No such entity with %fieldName = %fieldValue" }));

    const result = await main({ ...baseParams, customerId: 7 });

    expect(result).toMatchObject({
      statusCode: 404,
      body: { error: "Customer not found. It may already have been deleted." },
    });
  });

  it("returns 502 when Magento errors", async () => {
    mockAxios.mockRejectedValue(httpError(500, { message: "SQLSTATE..." }));

    const result = await main({ ...baseParams, customerId: 7 });

    expect(result).toMatchObject({ statusCode: 502, body: { error: "Magento returned an error. Try again, or check Magento's logs." } });
  });

  it("returns 429 when Magento rate-limits", async () => {
    mockAxios.mockRejectedValue(httpError(429));

    const result = await main({ ...baseParams, customerId: 7 });

    expect(result.statusCode).toBe(429);
  });
});
