import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/product/search";
import { ProductSearchParams } from "../actions-src/product/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: ProductSearchParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
  query: "24-MB01",
};

const defaultAttributeSets = { items: [{ attribute_set_id: 4, attribute_set_name: "Default" }] };
const defaultWebsites = [{ id: 1, name: "Main Website" }];

/**
 * product/search now fires three Commerce calls in parallel (the product
 * search itself, attribute sets, and websites) - this routes each by URL so
 * a single mock can answer all three distinctly, instead of one uniform
 * mockResolvedValue that would (incorrectly) return the same shape to all of
 * them.
 */
function mockCommerceResponses(overrides: {
  products?: { items: unknown[]; total_count: number };
  attributeSets?: typeof defaultAttributeSets;
  websites?: typeof defaultWebsites;
}) {
  mockAxios.mockImplementation((config: unknown) => {
    const url = (config as { url: string }).url;
    if (url.includes("attribute-sets")) {
      return Promise.resolve({ data: overrides.attributeSets ?? defaultAttributeSets });
    }
    if (url.includes("store/websites")) {
      return Promise.resolve({ data: overrides.websites ?? defaultWebsites });
    }
    return Promise.resolve({ data: overrides.products ?? { items: [], total_count: 0 } });
  });
}

function getProductSearchUrl(): string {
  const calls = mockAxios.mock.calls as unknown as { url: string }[][];
  const call = calls.find(([config]) => !config.url.includes("attribute-sets") && !config.url.includes("store/websites"));
  if (!call) {
    throw new Error("No product search call found");
  }
  return call[0].url;
}

describe("product search action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("returns items/totalCount/page/pageSize on a successful search", async () => {
    mockCommerceResponses({
      products: { items: [{ sku: "24-MB01", name: "Joust Duffle Bag", price: 34 }], total_count: 1 },
    });

    const result = await main(baseParams);

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      type: "Product search",
      response: {
        items: [{ sku: "24-MB01", name: "Joust Duffle Bag", price: 34, thumbnailPath: null }],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      },
    });
  });

  it("resolves each item's thumbnailPath from its thumbnail custom attribute", async () => {
    mockCommerceResponses({
      products: {
        items: [
          {
            sku: "24-MB01",
            custom_attributes: [
              { attribute_code: "image", value: "/m/b/mb01-blue-0.jpg" },
              { attribute_code: "thumbnail", value: "/m/b/mb01-thumb.jpg" },
            ],
          },
          { sku: "no-image", custom_attributes: [{ attribute_code: "thumbnail", value: "no_selection" }] },
        ],
        total_count: 2,
      },
    });

    const result = await main({ ...baseParams, query: "" });

    expect(result.body).toMatchObject({
      response: {
        items: [
          { sku: "24-MB01", thumbnailPath: "/m/b/mb01-thumb.jpg" },
          { sku: "no-image", thumbnailPath: null },
        ],
      },
    });
  });

  it("maps attribute_set_id and website_ids to their Commerce display names", async () => {
    mockCommerceResponses({
      products: {
        items: [
          {
            sku: "24-MB01",
            type_id: "simple",
            visibility: 4,
            attribute_set_id: 9,
            extension_attributes: { website_ids: [1, 2] },
          },
        ],
        total_count: 1,
      },
      attributeSets: { items: [{ attribute_set_id: 9, attribute_set_name: "Bags" }] },
      websites: [
        { id: 1, name: "Main Website" },
        { id: 2, name: "EU Website" },
      ],
    });

    const result = await main({ ...baseParams, query: "" });

    expect(result.body).toMatchObject({
      response: {
        items: [
          {
            sku: "24-MB01",
            typeLabel: "Simple Product",
            visibilityLabel: "Catalog, Search",
            attributeSetName: "Bags",
            websiteNames: ["Main Website", "EU Website"],
          },
        ],
      },
    });
  });

  it("builds an OR searchCriteria over sku and name with unencoded bracket keys, and passes pagination through", async () => {
    mockCommerceResponses({});

    await main({ ...baseParams, query: "bag", page: 2, pageSize: 10 });

    const calledUrl = getProductSearchUrl();
    expect(calledUrl).toContain("searchCriteria[filter_groups][0][filters][0][field]=sku");
    expect(calledUrl).toContain("searchCriteria[filter_groups][0][filters][1][field]=name");
    expect(calledUrl).toContain("[value]=%25bag%25");
    expect(calledUrl).toContain("searchCriteria[sortOrders][0][field]=created_at");
    expect(calledUrl).toContain("searchCriteria[sortOrders][0][direction]=DESC");
    expect(calledUrl).toContain("searchCriteria[pageSize]=10");
    expect(calledUrl).toContain("searchCriteria[currentPage]=2");
  });

  it("returns an empty items array and zero totalCount when Commerce finds no matches", async () => {
    mockCommerceResponses({});

    const result = await main(baseParams);

    expect(result.body).toMatchObject({ response: { items: [], totalCount: 0 } });
  });

  it("treats a missing or blank query as 'browse all products', omitting filter_groups entirely", async () => {
    mockCommerceResponses({ products: { items: [{ sku: "a" }, { sku: "b" }], total_count: 2 } });

    const result = await main({ ...baseParams, query: "   " });

    const calledUrl = getProductSearchUrl();
    expect(calledUrl).not.toContain("filter_groups");
    expect(calledUrl).toContain("searchCriteria[sortOrders][0][field]=created_at");
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ response: { items: [{ sku: "a" }, { sku: "b" }], totalCount: 2 } });
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 401"));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });

  it("clamps invalid page/pageSize to safe defaults", async () => {
    mockCommerceResponses({});

    const result = await main({ ...baseParams, page: -5, pageSize: 99999 });

    expect(result.body).toMatchObject({ response: { page: 1, pageSize: 100 } });
  });
});
