import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/customer/create";
import { CustomerCreateData, CustomerCreateParams } from "../actions-src/customer/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const commerceParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
};

const validData: CustomerCreateData = {
  firstname: "Veronica",
  lastname: "Costello",
  email: "roni_cost@example.com",
  websiteId: 1,
  groupId: "2",
  storeId: 1,
};

function params(data: CustomerCreateData | undefined): CustomerCreateParams {
  return { ...commerceParams, data };
}

function calledConfig(): { url: string; method: string; data: unknown } {
  return (mockAxios.mock.calls as unknown as { url: string; method: string; data: unknown }[][])[0][0];
}

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  });
}

const createdCustomer = {
  id: 42,
  email: "roni_cost@example.com",
  firstname: "Veronica",
  lastname: "Costello",
  group_id: 2,
  website_id: 1,
  created_at: "2026-10-12 10:00:00",
};

describe("customer create action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("creates the customer via POST /V1/customers with no password, and returns the new list row", async () => {
    mockAxios.mockResolvedValue({ data: createdCustomer });

    const result = await main(params({ ...validData, firstname: "  Veronica ", email: " roni_cost@example.com " }));

    const config = calledConfig();
    expect(config.method).toBe("POST");
    expect(config.url).toBe("https://commerce.example.com/rest/V1/customers");
    expect(config.data).toEqual({
      customer: {
        email: "roni_cost@example.com",
        firstname: "Veronica",
        lastname: "Costello",
        website_id: 1,
        group_id: 2,
        store_id: 1,
      },
    });
    expect(config.data).not.toHaveProperty("password");
    expect(result).toEqual({
      statusCode: 200,
      body: {
        type: "Customer created",
        response: {
          customer: {
            id: 42,
            name: "Veronica Costello",
            email: "roni_cost@example.com",
            groupId: 2,
            websiteId: 1,
            createdAt: "2026-10-12 10:00:00",
          },
        },
      },
    });
  });

  it("leaves website/group/store to Magento's defaults when not provided", async () => {
    mockAxios.mockResolvedValue({ data: createdCustomer });

    await main(params({ firstname: "Veronica", lastname: "Costello", email: "roni_cost@example.com", groupId: "" }));

    expect(calledConfig().data).toEqual({
      customer: { email: "roni_cost@example.com", firstname: "Veronica", lastname: "Costello" },
    });
  });

  it.each([
    ["missing data entirely", undefined, "First name and last name are required"],
    ["blank first name", { ...validData, firstname: "   " }, "First name and last name are required"],
    ["missing last name", { ...validData, lastname: undefined }, "First name and last name are required"],
    ["over-long name", { ...validData, lastname: "x".repeat(256) }, "Names can be at most 255 characters"],
    ["missing email", { ...validData, email: undefined }, "A valid email address is required"],
    ["malformed email", { ...validData, email: "not-an-email" }, "A valid email address is required"],
    ["over-long email", { ...validData, email: `${"a".repeat(250)}@x.io` }, "A valid email address is required"],
    ["non-numeric groupId", { ...validData, groupId: "abc" }, "Invalid groupId"],
    ["zero websiteId", { ...validData, websiteId: 0 }, "Invalid websiteId"],
    ["negative storeId", { ...validData, storeId: -1 }, "Invalid storeId"],
  ])("rejects %s with a 400 and never calls Magento", async (_label, data, expectedError) => {
    const result = await main(params(data as CustomerCreateData | undefined));

    expect(result).toMatchObject({ statusCode: 400, body: { success: false, error: expectedError } });
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("passes Magento's duplicate-email rejection back to the admin as a 400", async () => {
    mockAxios.mockRejectedValue(
      httpError(400, { message: "A customer with the same email address already exists in an associated website." })
    );

    const result = await main(params(validData));

    expect(result).toMatchObject({
      statusCode: 400,
      body: { error: "A customer with the same email address already exists in an associated website." },
    });
  });

  it("passes Magento's store/website mismatch rejection back as a 400", async () => {
    mockAxios.mockRejectedValue(httpError(400, { message: "The store view is not in the associated website." }));

    const result = await main(params(validData));

    expect(result).toMatchObject({ statusCode: 400, body: { error: "The store view is not in the associated website." } });
  });

  it("returns 502 when the integration isn't allowed to set the customer group", async () => {
    mockAxios.mockRejectedValue(httpError(403, { message: "The consumer isn't authorized to access %resources." }));

    const result = await main(params(validData));

    expect(result).toMatchObject({
      statusCode: 502,
      body: { error: "This app's Magento integration isn't allowed to perform this operation." },
    });
  });

  it("returns 502 when Magento's response has no customer id", async () => {
    mockAxios.mockResolvedValue({ data: true });

    const result = await main(params(validData));

    expect(result.statusCode).toBe(502);
  });

  it("returns 504 when Magento times out", async () => {
    mockAxios.mockRejectedValue(Object.assign(new Error("timeout"), { isAxiosError: true, code: "ECONNABORTED" }));

    const result = await main(params(validData));

    expect(result.statusCode).toBe(504);
  });
});
