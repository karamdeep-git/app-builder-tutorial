import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/category/list";
import { CategoryListParams } from "../actions-src/category/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: CategoryListParams = {
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
  is_active: true,
  children_data: [
    {
      id: 44,
      name: "What's New",
      parent_id: 2,
      is_active: true,
      children_data: [{ id: 27, name: "Tops", parent_id: 44, is_active: false, children_data: [] }],
    },
  ],
};

describe("category list action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("flattens the tree depth-first, including the root as a selectable parent", async () => {
    mockAxios.mockResolvedValue({ data: sampleTree });

    const result = await main(baseParams);

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      type: "Categories",
      response: {
        categories: [
          { id: 2, name: "Default Category", parentId: 1, isActive: true, level: 0 },
          { id: 44, name: "What's New", parentId: 2, isActive: true, level: 1 },
          { id: 27, name: "Tops", parentId: 44, isActive: false, level: 2 },
        ],
      },
    });
  });

  it("returns a 500 error when the Commerce API call fails", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 401"));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
