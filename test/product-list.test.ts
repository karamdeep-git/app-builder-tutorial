import { AdobeState } from "@adobe/aio-lib-state";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/product/list";
import { getStateClient } from "../actions-src/utils/lib-state/state-client";

jest.mock("../actions-src/utils/lib-state/state-client");

const mockGetStateClient = getStateClient as jest.MockedFunction<typeof getStateClient>;

function makeMockStateClient(): jest.Mocked<AdobeState> {
  return {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    deleteAll: jest.fn(),
    any: jest.fn(),
    stats: jest.fn(),
    list: jest.fn(),
    getRegionalEndpoint: jest.fn(),
  } as unknown as jest.Mocked<AdobeState>;
}

describe("product list action", () => {
  let mockStateClient: jest.Mocked<AdobeState>;

  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
    mockStateClient = makeMockStateClient();
    mockGetStateClient.mockResolvedValue(mockStateClient);
  });

  it("returns all products found in state", async () => {
    mockStateClient.list.mockImplementation(
      () =>
        (async function* () {
          yield { keys: ["product-a", "product-b"] };
        })() as ReturnType<AdobeState["list"]>
    );
    mockStateClient.get.mockImplementation(async (key: string) => {
      const value = key === "product-a" ? { sku: "A", name: "Product A" } : { sku: "B", name: "Product B" };
      return { value: JSON.stringify(value), expiration: "" };
    });

    const result = await main();

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      type: "Product list",
      response: {
        products: [
          { sku: "A", name: "Product A" },
          { sku: "B", name: "Product B" },
        ],
      },
    });
  });

  it("returns an empty list when no products exist", async () => {
    mockStateClient.list.mockImplementation(
      () =>
        (async function* () {
          yield { keys: [] };
        })() as ReturnType<AdobeState["list"]>
    );

    const result = await main();

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ type: "Product list", response: { products: [] } });
    expect(mockStateClient.get).not.toHaveBeenCalled();
  });

  it("returns a 500 error when state listing fails", async () => {
    mockStateClient.list.mockImplementation(() => {
      throw new Error("state unavailable");
    });

    const result = await main();

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
