import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { main } from "../actions-src/product/image";
import { ProductImageParams } from "../actions-src/product/types/request";

jest.mock("axios");

const mockAxios = axios as unknown as { get: jest.Mock };

const baseParams: ProductImageParams = {
  COMMERCE_BASE_URL: "https://commerce.example.com/",
  path: "/m/b/mb01-blue-0.jpg",
};

describe("product image action", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  it("proxies the image bytes from Magento with the right content-type", async () => {
    const bytes = Buffer.from("fake-jpeg-bytes");
    mockAxios.get = jest.fn().mockResolvedValue({ data: bytes, headers: { "content-type": "image/jpeg" } });

    const result = await main(baseParams);

    expect(mockAxios.get).toHaveBeenCalledWith(
      "https://commerce.example.com/media/catalog/product/m/b/mb01-blue-0.jpg",
      expect.objectContaining({ responseType: "arraybuffer" })
    );
    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({ "Content-Type": "image/jpeg" });
    expect(result.body).toBe(bytes.toString("base64"));
  });

  it("marks the response private so shared caches can't replay an authenticated response", async () => {
    mockAxios.get = jest.fn().mockResolvedValue({ data: Buffer.from("x"), headers: { "content-type": "image/png" } });

    const result = await main(baseParams);

    expect(result.headers).toMatchObject({ "Cache-Control": "private, max-age=86400" });
  });

  it.each(["/../../app/etc/env.php", "/m/b/../../../../app/etc/env.php", "/m/./b/x.jpg", "/.."])(
    "rejects a path with dot segments (%s)",
    async (path: string) => {
      const result = await main({ ...baseParams, path });

      expect(result.statusCode).toBe(400);
      expect(mockAxios.get).not.toHaveBeenCalled();
    }
  );

  it("still accepts file names that merely contain dots", async () => {
    mockAxios.get = jest.fn().mockResolvedValue({ data: Buffer.from("x"), headers: { "content-type": "image/jpeg" } });

    const result = await main({ ...baseParams, path: "/m/b/mb01.blue..v2.jpg" });

    expect(result.statusCode).toBe(200);
  });

  it("rejects a request with no path", async () => {
    const { path: _path, ...rest } = baseParams;
    const result = await main(rest as ProductImageParams);

    expect(result.statusCode).toBe(400);
    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  it("rejects a path that isn't a simple path segment (no host/protocol/traversal)", async () => {
    const result = await main({ ...baseParams, path: "://evil.example.com/x" });

    expect(result.statusCode).toBe(400);
    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  it("returns a 500 error when the Commerce media fetch fails", async () => {
    mockAxios.get = jest.fn().mockRejectedValue(new Error("Request failed with status code 404"));

    const result = await main(baseParams);

    expect(result.statusCode).toBe(500);
    expect(result.body).toMatchObject({ success: false });
  });
});
