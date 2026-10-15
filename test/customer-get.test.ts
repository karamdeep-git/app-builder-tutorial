import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/customer/get";
import { CustomerGetParams } from "../actions-src/customer/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: CustomerGetParams = {
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

describe("customer get action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("returns the customer's details with addresses flattened for display", async () => {
    mockAxios.mockResolvedValue({
      data: {
        id: 7,
        email: "roni_cost@example.com",
        firstname: "Veronica",
        lastname: "Costello",
        group_id: 1,
        website_id: 1,
        store_id: 1,
        created_in: "Default Store View",
        created_at: "2026-09-17 12:01:33",
        updated_at: "2026-09-18 08:00:00",
        dob: "1973-12-15",
        gender: 2,
        addresses: [
          {
            id: 3,
            firstname: "Veronica",
            lastname: "Costello",
            street: ["6146 Honey Bluff Parkway"],
            city: "Calder",
            region: { region: "Michigan", region_code: "MI", region_id: 33 },
            postcode: "49628-7978",
            country_id: "US",
            telephone: "(555) 229-3326",
            default_billing: true,
            default_shipping: true,
          },
        ],
      },
    });

    const result = await main({ ...baseParams, customerId: "7" });

    expect((mockAxios.mock.calls as unknown as { url: string }[][])[0][0].url).toBe(
      "https://commerce.example.com/rest/V1/customers/7"
    );
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      type: "Customer",
      response: {
        customer: {
          id: 7,
          name: "Veronica Costello",
          email: "roni_cost@example.com",
          groupId: 1,
          websiteId: 1,
          storeId: 1,
          createdIn: "Default Store View",
          dob: "1973-12-15",
          addresses: [
            {
              id: 3,
              name: "Veronica Costello",
              street: ["6146 Honey Bluff Parkway"],
              city: "Calder",
              region: "Michigan",
              postcode: "49628-7978",
              countryId: "US",
              telephone: "(555) 229-3326",
              isDefaultBilling: true,
              isDefaultShipping: true,
            },
          ],
        },
      },
    });
  });

  it("returns an empty address list and nulls for a customer with minimal data", async () => {
    mockAxios.mockResolvedValue({ data: { id: 8, email: "a@example.com", firstname: "A", lastname: "B", group_id: 1, website_id: 1 } });

    const result = await main({ ...baseParams, customerId: 8 });

    expect(result.body).toMatchObject({ response: { customer: { addresses: [], dob: null, createdIn: null } } });
  });

  it.each([undefined, "", "abc", "0", "-1", "1.5", "7; DROP"])("rejects customerId %p without calling Magento", async (customerId) => {
    const result = await main({ ...baseParams, customerId });

    expect(result).toMatchObject({ statusCode: 400, body: { error: "Missing or invalid customerId" } });
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("returns 404 when Magento has no such customer", async () => {
    mockAxios.mockRejectedValue(httpError(404, { message: "No such entity with %fieldName = %fieldValue" }));

    const result = await main({ ...baseParams, customerId: 999 });

    expect(result).toMatchObject({ statusCode: 404, body: { error: "Customer not found. It may have been deleted." } });
  });

  it("returns 502 when Magento's response has no customer id", async () => {
    mockAxios.mockResolvedValue({ data: {} });

    const result = await main({ ...baseParams, customerId: 7 });

    expect(result.statusCode).toBe(502);
  });

  it("returns 502 when Magento is unreachable", async () => {
    mockAxios.mockRejectedValue(Object.assign(new Error("getaddrinfo ENOTFOUND"), { isAxiosError: true, code: "ENOTFOUND" }));

    const result = await main({ ...baseParams, customerId: 7 });

    expect(result).toMatchObject({ statusCode: 502, body: { error: "Couldn't reach Magento. Check that the store is online." } });
  });
});
