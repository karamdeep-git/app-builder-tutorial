import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/order/hold";
import { OrderHoldParams } from "../actions-src/order/types/request";

jest.mock("axios");

const mockAxios = axios as jest.MockedFunction<typeof axios>;

const baseParams: OrderHoldParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  COMMERCE_CONSUMER_KEY: "key",
  COMMERCE_CONSUMER_SECRET: "secret",
  COMMERCE_ACCESS_TOKEN: "token",
  COMMERCE_ACCESS_TOKEN_SECRET: "token-secret",
  orderId: 1,
};

describe("order hold action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("posts to the default Magento hold endpoint for the given order", async () => {
    mockAxios.mockResolvedValue({ data: true });

    const result = await main(baseParams);

    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("/orders/1/hold"), method: "POST" })
    );
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ response: { orderId: "1", result: true } });
  });

  it("rejects a request with no orderId", async () => {
    const result = await main({ ...baseParams, orderId: "" });

    expect(result.statusCode).toBe(400);
    expect(mockAxios).not.toHaveBeenCalled();
  });

  it("surfaces Magento's error (eg. an order that can't be held) as a 500", async () => {
    mockAxios.mockRejectedValue(new Error("Request failed with status code 400"));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
