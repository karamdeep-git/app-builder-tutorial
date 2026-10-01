import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/product/categories";
import { ProductCategoriesParams } from "../actions-src/product/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: ProductCategoriesParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
  COMMERCE_STORE_CODES: "[]",
};

const sampleTree = {
  id: 2,
  name: "Default Category",
  parent_id: 1,
  children_data: [
    {
      id: 44,
      name: "What's New",
      parent_id: 2,
      children_data: [],
    },
    {
      id: 26,
      name: "Women",
      parent_id: 2,
      children_data: [
        {
          id: 27,
          name: "Tops",
          parent_id: 26,
          children_data: [{ id: 29, name: "Jackets", parent_id: 27, children_data: [] }],
        },
      ],
    },
  ],
};

describe("product categories action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("flattens the category tree depth-first, skipping the synthetic root, with relative levels", async () => {
    mockAxios.mockResolvedValue({ data: sampleTree });

    const result = await main(baseParams);

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      type: "Categories",
      response: {
        categories: [
          { id: 44, name: "What's New", level: 0 },
          { id: 26, name: "Women", level: 0 },
          { id: 27, name: "Tops", level: 1 },
          { id: 29, name: "Jackets", level: 2 },
        ],
      },
    });
  });

  it("returns an empty list when the root has no children", async () => {
    mockAxios.mockResolvedValue({ data: { id: 2, name: "Default Category", parent_id: 1 } });

    const result = await main(baseParams);

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ response: { categories: [] } });
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 401"));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
