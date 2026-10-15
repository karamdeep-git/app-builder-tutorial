import { initializeTestLogger, log } from "../actions-src/logger";
import {
  commerceErrorResponse,
  formatMagentoMessage,
  UnexpectedCommerceResponseError,
} from "../actions-src/utils/adobe-commerce/errors";

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  });
}

function codeError(code: string) {
  return Object.assign(new Error(code), { isAxiosError: true, code });
}

function loggedErrors(): string {
  return (log().error as jest.Mock).mock.calls.map((call) => String(call[0])).join("\n");
}

describe("formatMagentoMessage", () => {
  it("fills named placeholders from an object of parameters", () => {
    expect(formatMagentoMessage({ message: '"%fieldName" is required.', parameters: { fieldName: "email" } })).toBe(
      '"email" is required.'
    );
  });

  it("fills positional placeholders from an array of parameters", () => {
    expect(formatMagentoMessage({ message: "%1 of %2", parameters: ["one", "two"] })).toBe("one of two");
  });

  it("leaves placeholders it has no value for untouched", () => {
    expect(formatMagentoMessage({ message: "%1 and %2", parameters: ["one"] })).toBe("one and %2");
    expect(formatMagentoMessage({ message: "%known %unknown", parameters: { known: "x" } })).toBe("x %unknown");
  });

  it("returns the message as-is when there are no parameters", () => {
    expect(formatMagentoMessage({ message: "Plain message" })).toBe("Plain message");
  });

  it("returns undefined when the body has no usable message", () => {
    expect(formatMagentoMessage(undefined)).toBeUndefined();
    expect(formatMagentoMessage({})).toBeUndefined();
    expect(formatMagentoMessage({ message: 42 })).toBeUndefined();
    expect(formatMagentoMessage("not an object")).toBeUndefined();
  });
});

describe("commerceErrorResponse", () => {
  beforeEach(() => {
    initializeTestLogger();
  });

  it("passes a Magento validation error (400) through with its filled-in message", () => {
    const result = commerceErrorResponse(
      httpError(400, { message: "A customer with the same email address already exists in an associated website." }),
      "Customer create"
    );

    expect(result).toEqual({
      statusCode: 400,
      body: {
        success: false,
        error: "A customer with the same email address already exists in an associated website.",
      },
    });
  });

  it("falls back to a generic message for a 400 with no Magento message", () => {
    expect(commerceErrorResponse(httpError(400, {}), "x").body).toMatchObject({ error: "Magento rejected the request." });
  });

  it("maps other 4xx statuses (e.g. 409) to 400 with Magento's message", () => {
    const result = commerceErrorResponse(httpError(409, { message: "Conflict" }), "x");
    expect(result.statusCode).toBe(400);
    expect(result.body).toMatchObject({ error: "Conflict" });
  });

  it("maps 404 to 404 with the caller's not-found message", () => {
    const result = commerceErrorResponse(httpError(404, { message: "No such entity" }), "x", "Customer not found.");
    expect(result).toMatchObject({ statusCode: 404, body: { error: "Customer not found." } });
  });

  it.each([
    [401, 502, "Magento rejected this app's integration credentials."],
    [403, 502, "This app's Magento integration isn't allowed to perform this operation."],
    [429, 429, "Magento is rate-limiting requests. Try again shortly."],
    [500, 502, "Magento returned an error. Try again, or check Magento's logs."],
    [503, 502, "Magento returned an error. Try again, or check Magento's logs."],
  ])("maps Magento %i to %i without leaking Magento's internal detail", (magentoStatus, expectedStatus, expectedError) => {
    const result = commerceErrorResponse(httpError(magentoStatus, { message: "internal detail", trace: "#0 ..." }), "x");

    expect(result.statusCode).toBe(expectedStatus);
    expect(result.body).toEqual({ success: false, error: expectedError });
  });

  it.each(["ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED"])("maps a %s timeout to 504", (code) => {
    expect(commerceErrorResponse(codeError(code), "x")).toMatchObject({
      statusCode: 504,
      body: { error: "Magento didn't respond in time. Try again." },
    });
  });

  it("maps a network failure with no response to 502", () => {
    expect(commerceErrorResponse(codeError("ENOTFOUND"), "x")).toMatchObject({
      statusCode: 502,
      body: { error: "Couldn't reach Magento. Check that the store is online." },
    });
  });

  it("maps an unexpected Magento response shape to 502", () => {
    expect(commerceErrorResponse(new UnexpectedCommerceResponseError("no items array"), "x")).toMatchObject({
      statusCode: 502,
      body: { error: "Magento returned an unexpected response." },
    });
  });

  it("maps any other exception to a generic 500 without echoing its message to the caller", () => {
    const result = commerceErrorResponse(new TypeError("Cannot read properties of undefined"), "Customer get");

    expect(result).toEqual({ statusCode: 500, body: { success: false, error: "Unexpected error. Check the action logs." } });
    expect(loggedErrors()).toContain("Customer get failed: unexpected error - Cannot read properties of undefined");
  });

  it("logs status and Magento's message template, never the filled-in values (customer PII)", () => {
    commerceErrorResponse(
      httpError(400, { message: 'Invalid value of "%value" provided for the %fieldName field.', parameters: { value: "pii@example.com", fieldName: "email" } }),
      "Customer create"
    );

    const logs = loggedErrors();
    expect(logs).toContain("Customer create failed: Magento status=400");
    expect(logs).toContain("%value");
    expect(logs).not.toContain("pii@example.com");
  });
});
