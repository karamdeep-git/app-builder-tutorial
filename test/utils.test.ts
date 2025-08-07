import * as utils from "../actions-src/utils";

test("interface", () => {
  expect(typeof utils.errorResponse).toBe("function");
  expect(typeof utils.stringParameters).toBe("function");
  expect(typeof utils.checkMissingRequestInputs).toBe("function");
  expect(typeof utils.getBearerToken).toBe("function");
  expect(typeof utils.parseStoreConfigs).toBe("function");
});

describe("errorResponse", () => {
  test("(400, errorMessage)", () => {
    const res = utils.errorResponse(400, "errorMessage");
    expect(res).toEqual({
      error: {
        statusCode: 400,
        body: { error: "errorMessage" },
      },
    });
  });

  test("(400, errorMessage, logger)", () => {
    const logger = {
      info: jest.fn(),
    };
    const res = utils.errorResponse(400, "errorMessage", logger);
    expect(logger.info).toHaveBeenCalledWith("400: errorMessage");
    expect(res).toEqual({
      error: {
        statusCode: 400,
        body: { error: "errorMessage" },
      },
    });
  });
});

describe("stringParameters", () => {
  test("no auth header", () => {
    const params = {
      a: 1,
      b: 2,
      __ow_headers: { "x-api-key": "fake-api-key" },
    };
    expect(utils.stringParameters(params)).toEqual(JSON.stringify(params));
  });
  test("with auth header", () => {
    const params = {
      a: 1,
      b: 2,
      __ow_headers: { "x-api-key": "fake-api-key", authorization: "secret" },
    };
    expect(utils.stringParameters(params)).toEqual(expect.stringContaining('"authorization":"<hidden>"'));
    expect(utils.stringParameters(params)).not.toEqual(expect.stringContaining("secret"));
  });
});

describe("checkMissingRequestInputs", () => {
  test("({ a: 1, b: 2 }, [a])", () => {
    expect(utils.checkMissingRequestInputs({ a: 1, b: 2 }, ["a"])).toEqual(null);
  });
  test("({ a: 1 }, [a, b])", () => {
    expect(utils.checkMissingRequestInputs({ a: 1 }, ["a", "b"])).toEqual("missing parameter(s) 'b'");
  });
  test("({ a: { b: { c: 1 } }, f: { g: 2 } }, [a.b.c, f.g.h.i])", () => {
    expect(utils.checkMissingRequestInputs({ a: { b: { c: 1 } }, f: { g: 2 } }, ["a.b.c", "f.g.h.i"])).toEqual(
      "missing parameter(s) 'f.g.h.i'"
    );
  });
  test("({ a: { b: { c: 1 } }, f: { g: 2 } }, [a.b.c, f.g.h])", () => {
    expect(utils.checkMissingRequestInputs({ a: { b: { c: 1 } }, f: { g: 2 } }, ["a.b.c", "f"])).toEqual(null);
  });
  test("({ a: 1, __ow_headers: { h: '1', i: '2' } }, undefined, [h])", () => {
    expect(utils.checkMissingRequestInputs({ a: 1, __ow_headers: { h: "1", i: "2" } }, undefined, ["h"])).toEqual(null);
  });
  test("({ a: 1, __ow_headers: { f: '2' } }, [a], [h, i])", () => {
    expect(utils.checkMissingRequestInputs({ a: 1, __ow_headers: { f: "2" } }, ["a"], ["h", "i"])).toEqual(
      "missing header(s) 'h,i'"
    );
  });
  test("({ c: 1, __ow_headers: { f: '2' } }, [a, b], [h, i])", () => {
    expect(utils.checkMissingRequestInputs({ c: 1 }, ["a", "b"], ["h", "i"])).toEqual(
      "missing header(s) 'h,i' and missing parameter(s) 'a,b'"
    );
  });
  test("({ a: 0 }, [a])", () => {
    expect(utils.checkMissingRequestInputs({ a: 0 }, ["a"])).toEqual(null);
  });
  test("({ a: null }, [a])", () => {
    expect(utils.checkMissingRequestInputs({ a: null }, ["a"])).toEqual(null);
  });
  test("({ a: '' }, [a])", () => {
    expect(utils.checkMissingRequestInputs({ a: "" }, ["a"])).toEqual("missing parameter(s) 'a'");
  });
  test("({ a: undefined }, [a])", () => {
    expect(utils.checkMissingRequestInputs({ a: undefined }, ["a"])).toEqual("missing parameter(s) 'a'");
  });
});

describe("getBearerToken", () => {
  test("({})", () => {
    expect(utils.getBearerToken({})).toEqual(undefined);
  });
  test("({ authorization: Bearer fake, __ow_headers: {} })", () => {
    expect(utils.getBearerToken({ authorization: "Bearer fake", __ow_headers: {} })).toEqual(undefined);
  });
  test("({ authorization: Bearer fake, __ow_headers: { authorization: fake } })", () => {
    expect(utils.getBearerToken({ authorization: "Bearer fake", __ow_headers: { authorization: "fake" } })).toEqual(
      undefined
    );
  });
  test("({ __ow_headers: { authorization: Bearerfake} })", () => {
    expect(utils.getBearerToken({ __ow_headers: { authorization: "Bearerfake" } })).toEqual(undefined);
  });
  test("({ __ow_headers: { authorization: Bearer fake} })", () => {
    expect(utils.getBearerToken({ __ow_headers: { authorization: "Bearer fake" } })).toEqual("fake");
  });
  test("({ __ow_headers: { authorization: Bearer fake Bearer fake} })", () => {
    expect(utils.getBearerToken({ __ow_headers: { authorization: "Bearer fake Bearer fake" } })).toEqual(
      "fake Bearer fake"
    );
  });
});

describe("parseStoreConfigs", () => {
  test("should parse basic store configuration without storeUrl", () => {
    const input = '[{"storeCode": "us"}]';
    const result = utils.parseStoreConfigs(input);
    expect(result).toEqual([{ storeCode: "us", storeUrl: undefined }]);
  });

  test("should parse store configuration with storeUrl", () => {
    const input = '[{"storeCode": "pl", "storeUrl": "https://pl.mystore.com"}]';
    const result = utils.parseStoreConfigs(input);
    expect(result).toEqual([{ storeCode: "pl", storeUrl: "https://pl.mystore.com" }]);
  });

  test("should parse multiple stores with mixed storeUrl configuration", () => {
    const input = '[{"storeCode": "us"}, {"storeCode": "pl", "storeUrl": "https://pl.mystore.com"}]';
    const result = utils.parseStoreConfigs(input);
    expect(result).toEqual([
      { storeCode: "us", storeUrl: undefined },
      { storeCode: "pl", storeUrl: "https://pl.mystore.com" },
    ]);
  });

  test("should trim whitespace from storeUrl", () => {
    const input = '[{"storeCode": "us", "storeUrl": "  https://us.mystore.com  "}]';
    const result = utils.parseStoreConfigs(input);
    expect(result).toEqual([{ storeCode: "us", storeUrl: "https://us.mystore.com" }]);
  });

  test("should handle empty storeUrl as undefined", () => {
    const input = '[{"storeCode": "us", "storeUrl": ""}]';
    const result = utils.parseStoreConfigs(input);
    expect(result).toEqual([{ storeCode: "us", storeUrl: undefined }]);
  });

  test("should throw error when storeUrl is not a string", () => {
    const input = '[{"storeCode": "us", "storeUrl": 123}]';
    expect(() => utils.parseStoreConfigs(input)).toThrow("storeUrl must be a string when provided");
  });

  test("should throw error for invalid JSON", () => {
    const input = "invalid json";
    expect(() => utils.parseStoreConfigs(input)).toThrow("Failed to parse COMMERCE_STORE_CODES");
  });

  test("should throw error for non-array input", () => {
    const input = '{"storeCode": "us"}';
    expect(() => utils.parseStoreConfigs(input)).toThrow("Store codes must be an array");
  });

  test("should throw error when storeCode is missing", () => {
    const input = "[{}]";
    expect(() => utils.parseStoreConfigs(input)).toThrow("storeCode must be a string");
  });
});
