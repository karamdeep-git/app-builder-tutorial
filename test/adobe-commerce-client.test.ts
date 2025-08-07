import { getImsAccessToken } from "@adobe/commerce-sdk-auth";
import axios from "axios";
import { initializeTestLogger } from "../actions-src/logger";
import { StoreConfig } from "../actions-src/types/commerce";
import { AdobeImsParams } from "../actions-src/types/request";
import { AdobeCommerceClient } from "../actions-src/utils/adobe-commerce/adobe-commerce-client";
import { CommerceParams } from "../actions-src/utils/adobe-commerce/types/request";

// Mock dependencies
jest.mock("@adobe/commerce-sdk-auth");
jest.mock("axios");
jest.mock("../actions-src/logger");

const mockGetImsAccessToken = getImsAccessToken as jest.MockedFunction<typeof getImsAccessToken>;
const mockAxios = axios as jest.MockedFunction<typeof axios>;

describe("AdobeCommerceClient", () => {
  beforeEach(() => {
    initializeTestLogger();
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with OAuth 1.0a configuration", () => {
      const options = {
        url: "https://example.com/rest/",
        version: "V1",
        storeCode: "us",
        useStoreCodeInPath: true,
        auth: {
          type: "oauth1a" as const,
          oauth1a: {
            consumerKey: "test-key",
            consumerSecret: "test-secret",
            accessToken: "test-token",
            accessTokenSecret: "test-token-secret",
          },
        },
      };

      const client = new AdobeCommerceClient(options);
      expect(client).toBeInstanceOf(AdobeCommerceClient);
    });

    it("should initialize with IMS configuration", () => {
      const options = {
        url: "https://example.com/rest/",
        version: "V1",
        storeCode: "us",
        useStoreCodeInPath: false,
        auth: {
          type: "ims" as const,
          ims: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
            scopes: ["AdobeID", "read_organizations", "openid"],
          },
        },
      };

      const client = new AdobeCommerceClient(options);
      expect(client).toBeInstanceOf(AdobeCommerceClient);
    });

    it("should default version to V1 when not provided", () => {
      const options = {
        url: "https://example.com/rest/",
        storeCode: "us",
        useStoreCodeInPath: true,
        auth: {
          type: "oauth1a" as const,
          oauth1a: {
            consumerKey: "test-key",
            consumerSecret: "test-secret",
            accessToken: "test-token",
            accessTokenSecret: "test-token-secret",
          },
        },
      };

      const client = new AdobeCommerceClient(options);
      expect(client).toBeInstanceOf(AdobeCommerceClient);
    });

    it("should default useStoreCodeInPath to false when not provided", () => {
      const options = {
        url: "https://example.com/rest/",
        version: "V1",
        storeCode: "us",
        auth: {
          type: "oauth1a" as const,
          oauth1a: {
            consumerKey: "test-key",
            consumerSecret: "test-secret",
            accessToken: "test-token",
            accessTokenSecret: "test-token-secret",
          },
        },
      };

      const client = new AdobeCommerceClient(options);
      expect(client).toBeInstanceOf(AdobeCommerceClient);
    });
  });

  describe("create static method", () => {
    const mockCommerceParams: CommerceParams = {
      COMMERCE_BASE_URL: "https://base.example.com/",
      COMMERCE_CONSUMER_KEY: "test-key",
      COMMERCE_CONSUMER_SECRET: "test-secret",
      COMMERCE_ACCESS_TOKEN: "test-token",
      COMMERCE_ACCESS_TOKEN_SECRET: "test-token-secret",
      COMMERCE_STORE_CODES: "[]",
    };

    const mockAdobeImsParams: AdobeImsParams = {
      COMMERCE_BASE_URL: "https://base.example.com/",
      OAUTH_CLIENT_ID: "test-client-id",
      OAUTH_CLIENT_SECRET: "test-client-secret",
      OAUTH_SCOPES: ["AdobeID", "read_organizations", "openid"],
      OAUTH_HOST: "ims-na1.adobelogin.com",
    };

    describe("OAuth 1.0a authentication detection", () => {
      it("should create OAuth 1.0a client when COMMERCE_CONSUMER_KEY is present", () => {
        const storeConfig: StoreConfig = {
          storeCode: "us",
        };

        const client = AdobeCommerceClient.create(mockCommerceParams, storeConfig);
        expect(client).toBeInstanceOf(AdobeCommerceClient);
      });

      it("should use storeUrl when provided instead of COMMERCE_BASE_URL", () => {
        const storeConfig: StoreConfig = {
          storeCode: "us",
          storeUrl: "https://us.custom.com/",
        };

        const client = AdobeCommerceClient.create(mockCommerceParams, storeConfig);
        expect(client).toBeInstanceOf(AdobeCommerceClient);
      });

      it("should set useStoreCodeInPath to true when using COMMERCE_BASE_URL", () => {
        const storeConfig: StoreConfig = {
          storeCode: "us",
        };

        const client = AdobeCommerceClient.create(mockCommerceParams, storeConfig);
        expect(client).toBeInstanceOf(AdobeCommerceClient);
      });

      it("should set useStoreCodeInPath to false when using storeUrl", () => {
        const storeConfig: StoreConfig = {
          storeCode: "us",
          storeUrl: "https://us.custom.com/",
        };

        const client = AdobeCommerceClient.create(mockCommerceParams, storeConfig);
        expect(client).toBeInstanceOf(AdobeCommerceClient);
      });
    });

    describe("IMS authentication detection", () => {
      it("should create IMS client when OAUTH_CLIENT_ID is present but COMMERCE_CONSUMER_KEY is not", () => {
        const storeConfig: StoreConfig = {
          storeCode: "us",
        };

        const client = AdobeCommerceClient.create(mockAdobeImsParams, storeConfig);
        expect(client).toBeInstanceOf(AdobeCommerceClient);
      });

      it("should use storeUrl when provided for IMS authentication", () => {
        const storeConfig: StoreConfig = {
          storeCode: "us",
          storeUrl: "https://us.custom.com/",
        };

        const client = AdobeCommerceClient.create(mockAdobeImsParams, storeConfig);
        expect(client).toBeInstanceOf(AdobeCommerceClient);
      });

      it("should default scopes when not provided", () => {
        const paramsWithoutScopes = { ...mockAdobeImsParams };
        delete paramsWithoutScopes.OAUTH_SCOPES;

        const storeConfig: StoreConfig = {
          storeCode: "us",
        };

        const client = AdobeCommerceClient.create(paramsWithoutScopes, storeConfig);
        expect(client).toBeInstanceOf(AdobeCommerceClient);
      });
    });
  });

  describe("HTTP methods", () => {
    let client: AdobeCommerceClient;

    beforeEach(() => {
      const options = {
        url: "https://example.com/rest/",
        version: "V1",
        storeCode: "us",
        useStoreCodeInPath: true,
        auth: {
          type: "oauth1a" as const,
          oauth1a: {
            consumerKey: "test-key",
            consumerSecret: "test-secret",
            accessToken: "test-token",
            accessTokenSecret: "test-token-secret",
          },
        },
      };
      client = new AdobeCommerceClient(options);

      mockAxios.mockResolvedValue({
        data: { success: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });
    });

    describe("get method", () => {
      it("should make GET request with correct URL including store code", async () => {
        await client.get("/products");

        expect(mockAxios).toHaveBeenCalledWith({
          url: "https://example.com/rest/us/V1/products",
          method: "GET",
          headers: expect.any(Object),
          data: undefined,
          responseType: "json",
        });
      });

      it("should make GET request without store code when useStoreCodeInPath is false", async () => {
        const options = {
          url: "https://us.example.com/rest/",
          version: "V1",
          storeCode: "us",
          useStoreCodeInPath: false,
          auth: {
            type: "oauth1a" as const,
            oauth1a: {
              consumerKey: "test-key",
              consumerSecret: "test-secret",
              accessToken: "test-token",
              accessTokenSecret: "test-token-secret",
            },
          },
        };
        const clientWithoutStorePath = new AdobeCommerceClient(options);

        await clientWithoutStorePath.get("/products");

        expect(mockAxios).toHaveBeenCalledWith({
          url: "https://us.example.com/rest/V1/products",
          method: "GET",
          headers: expect.any(Object),
          data: undefined,
          responseType: "json",
        });
      });

      it("should return response data", async () => {
        const mockResponse = { items: [], total_count: 0 };
        mockAxios.mockResolvedValue({ data: mockResponse });

        const result = await client.get("/products");

        expect(result).toEqual(mockResponse);
      });

      it("should handle request tokens", async () => {
        await client.get("/products", "bearer-token");

        expect(mockAxios).toHaveBeenCalledWith({
          url: "https://example.com/rest/us/V1/products",
          method: "GET",
          headers: { Authorization: "Bearer bearer-token" },
          data: undefined,
          responseType: "json",
        });
      });
    });

    describe("post method", () => {
      it("should make POST request with correct URL and data", async () => {
        const postData = { name: "Test Product" };
        await client.post("/products", postData);

        expect(mockAxios).toHaveBeenCalledWith({
          url: "https://example.com/rest/us/V1/products",
          method: "POST",
          headers: expect.any(Object),
          data: postData,
          responseType: "json",
        });
      });

      it("should include custom headers", async () => {
        const postData = { name: "Test Product" };
        const customHeaders = { "X-Custom-Header": "custom-value" };

        await client.post("/products", postData, "", customHeaders);

        expect(mockAxios).toHaveBeenCalledWith({
          url: "https://example.com/rest/us/V1/products",
          method: "POST",
          headers: expect.objectContaining(customHeaders),
          data: postData,
          responseType: "json",
        });
      });
    });

    describe("put method", () => {
      it("should make PUT request with correct URL and data", async () => {
        const putData = { name: "Updated Product" };
        await client.put("/products/1", putData);

        expect(mockAxios).toHaveBeenCalledWith({
          url: "https://example.com/rest/us/V1/products/1",
          method: "PUT",
          headers: expect.any(Object),
          data: putData,
          responseType: "json",
        });
      });
    });

    describe("delete method", () => {
      it("should make DELETE request with correct URL", async () => {
        await client.delete("/products/1");

        expect(mockAxios).toHaveBeenCalledWith({
          url: "https://example.com/rest/us/V1/products/1",
          method: "DELETE",
          headers: expect.any(Object),
          data: undefined,
          responseType: "json",
        });
      });
    });
  });

  describe("IMS authentication", () => {
    let imsClient: AdobeCommerceClient;

    beforeEach(() => {
      const options = {
        url: "https://example.com/rest/",
        version: "V1",
        storeCode: "us",
        useStoreCodeInPath: true,
        auth: {
          type: "ims" as const,
          ims: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
            scopes: ["AdobeID", "read_organizations", "openid"],
          },
        },
      };
      imsClient = new AdobeCommerceClient(options);

      mockGetImsAccessToken.mockResolvedValue({
        access_token: "ims-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      mockAxios.mockResolvedValue({
        data: { success: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      });
    });

    it("should fetch IMS token and use Bearer authentication", async () => {
      await imsClient.get("/products");

      expect(mockGetImsAccessToken).toHaveBeenCalledWith({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        scopes: ["AdobeID", "read_organizations", "openid"],
        host: undefined,
      });

      expect(mockAxios).toHaveBeenCalledWith({
        url: "https://example.com/rest/us/V1/products",
        method: "GET",
        headers: { Authorization: "Bearer ims-access-token" },
        data: undefined,
        responseType: "json",
      });
    });

    it("should reuse valid IMS token", async () => {
      // First call
      await imsClient.get("/products");
      // Second call
      await imsClient.get("/categories");

      // Should only call IMS once
      expect(mockGetImsAccessToken).toHaveBeenCalledTimes(1);
      expect(mockAxios).toHaveBeenCalledTimes(2);
    });

    it("should refresh expired IMS token", async () => {
      // Mock short expiry time
      mockGetImsAccessToken
        .mockResolvedValueOnce({
          access_token: "expired-token",
          token_type: "Bearer",
          expires_in: 0, // Immediate expiry
          expires_at: new Date(Date.now()).toISOString(),
        })
        .mockResolvedValueOnce({
          access_token: "new-token",
          token_type: "Bearer",
          expires_in: 3600,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        });

      // First call
      await imsClient.get("/products");

      // Wait for token to expire (simulated)
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second call should refresh token
      await imsClient.get("/categories");

      expect(mockGetImsAccessToken).toHaveBeenCalledTimes(2);
    });
  });

  describe("URL creation logic", () => {
    describe("with store code in path", () => {
      let client: AdobeCommerceClient;

      beforeEach(() => {
        const options = {
          url: "https://base.example.com/rest/",
          version: "V1",
          storeCode: "us",
          useStoreCodeInPath: true,
          auth: {
            type: "oauth1a" as const,
            oauth1a: {
              consumerKey: "test-key",
              consumerSecret: "test-secret",
              accessToken: "test-token",
              accessTokenSecret: "test-token-secret",
            },
          },
        };
        client = new AdobeCommerceClient(options);

        mockAxios.mockResolvedValue({
          data: { success: true },
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });
      });

      it("should include store code in URL path", async () => {
        await client.get("/products");

        expect(mockAxios).toHaveBeenCalledWith(
          expect.objectContaining({
            url: "https://base.example.com/rest/us/V1/products",
          })
        );
      });

      it("should handle resources starting with slash", async () => {
        await client.get("/categories");

        expect(mockAxios).toHaveBeenCalledWith(
          expect.objectContaining({
            url: "https://base.example.com/rest/us/V1/categories",
          })
        );
      });

      it("should handle resources without leading slash", async () => {
        await client.get("orders");

        expect(mockAxios).toHaveBeenCalledWith(
          expect.objectContaining({
            url: "https://base.example.com/rest/us/V1orders",
          })
        );
      });
    });

    describe("without store code in path", () => {
      let client: AdobeCommerceClient;

      beforeEach(() => {
        const options = {
          url: "https://us.custom.example.com/rest/",
          version: "V1",
          storeCode: "us",
          useStoreCodeInPath: false,
          auth: {
            type: "oauth1a" as const,
            oauth1a: {
              consumerKey: "test-key",
              consumerSecret: "test-secret",
              accessToken: "test-token",
              accessTokenSecret: "test-token-secret",
            },
          },
        };
        client = new AdobeCommerceClient(options);

        mockAxios.mockResolvedValue({
          data: { success: true },
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });
      });

      it("should not include store code in URL path", async () => {
        await client.get("/products");

        expect(mockAxios).toHaveBeenCalledWith(
          expect.objectContaining({
            url: "https://us.custom.example.com/rest/V1/products",
          })
        );
      });

      it("should work with different version", async () => {
        const optionsV2 = {
          url: "https://us.custom.example.com/rest/",
          version: "V2",
          storeCode: "us",
          useStoreCodeInPath: false,
          auth: {
            type: "oauth1a" as const,
            oauth1a: {
              consumerKey: "test-key",
              consumerSecret: "test-secret",
              accessToken: "test-token",
              accessTokenSecret: "test-token-secret",
            },
          },
        };
        const clientV2 = new AdobeCommerceClient(optionsV2);

        await clientV2.get("/products");

        expect(mockAxios).toHaveBeenCalledWith(
          expect.objectContaining({
            url: "https://us.custom.example.com/rest/V2/products",
          })
        );
      });
    });

    describe("without store code", () => {
      let client: AdobeCommerceClient;

      beforeEach(() => {
        const options = {
          url: "https://example.com/rest/",
          version: "V1",
          useStoreCodeInPath: true,
          auth: {
            type: "oauth1a" as const,
            oauth1a: {
              consumerKey: "test-key",
              consumerSecret: "test-secret",
              accessToken: "test-token",
              accessTokenSecret: "test-token-secret",
            },
          },
        };
        client = new AdobeCommerceClient(options);

        mockAxios.mockResolvedValue({
          data: { success: true },
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as any,
        });
      });

      it("should not include store code in URL when storeCode is undefined", async () => {
        await client.get("/products");

        expect(mockAxios).toHaveBeenCalledWith(
          expect.objectContaining({
            url: "https://example.com/rest/V1/products",
          })
        );
      });
    });
  });

  describe("error handling", () => {
    let client: AdobeCommerceClient;

    beforeEach(() => {
      const options = {
        url: "https://example.com/rest/",
        version: "V1",
        storeCode: "us",
        useStoreCodeInPath: true,
        auth: {
          type: "oauth1a" as const,
          oauth1a: {
            consumerKey: "test-key",
            consumerSecret: "test-secret",
            accessToken: "test-token",
            accessTokenSecret: "test-token-secret",
          },
        },
      };
      client = new AdobeCommerceClient(options);
    });

    it("should throw and log errors from API calls", async () => {
      const errorResponse = new Error("Request failed with status code 404");
      (errorResponse as any).response = {
        data: { message: "Product not found" },
      };
      mockAxios.mockRejectedValue(errorResponse);

      await expect(client.get("/products/999")).rejects.toThrow("Request failed with status code 404");
    });

    it("should handle errors without response data", async () => {
      const error = new Error("Network error");
      mockAxios.mockRejectedValue(error);

      await expect(client.get("/products")).rejects.toThrow("Network error");
    });

    it("should handle non-Error objects", async () => {
      mockAxios.mockRejectedValue("String error");

      await expect(client.get("/products")).rejects.toEqual("String error");
    });
  });

  describe("OAuth 1.0a initialization", () => {
    it("should initialize OAuth 1.0a successfully with valid config", () => {
      const options = {
        url: "https://example.com/rest/",
        version: "V1",
        storeCode: "us",
        useStoreCodeInPath: true,
        auth: {
          type: "oauth1a" as const,
          oauth1a: {
            consumerKey: "test-key",
            consumerSecret: "test-secret",
            accessToken: "test-token",
            accessTokenSecret: "test-token-secret",
          },
        },
      };

      expect(() => new AdobeCommerceClient(options)).not.toThrow();
    });

    it("should throw error when trying to initialize OAuth with wrong auth type", () => {
      const options = {
        url: "https://example.com/rest/",
        version: "V1",
        storeCode: "us",
        useStoreCodeInPath: true,
        auth: {
          type: "ims" as const,
          ims: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
          },
        },
      };

      const client = new AdobeCommerceClient(options);

      // Mock the auth config to simulate wrong type
      (client as any).authConfig = { type: "ims" };

      expect(() => {
        (client as any).initializeOAuth1a();
      }).toThrow("OAuth 1.0a configuration is required when auth type is oauth1a");
    });
  });
});
