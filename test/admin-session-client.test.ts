import axios from "axios";
import { login, setProductStatusAllStores } from "../actions-src/utils/adobe-commerce/admin-session-client";

jest.mock("axios");

const mockAxios = axios as unknown as { get: jest.Mock; post: jest.Mock };

const BASE_URL = "https://commerce.example.com/";
const LOGIN_PAGE_HTML = '<input name="form_key" type="hidden" value="abc123formkey" />';
const DASHBOARD_HTML = "<script>var FORM_KEY = 'rotatedformkey';</script>";

describe("admin session client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (axios as unknown as { get: jest.Mock }).get = jest.fn();
    (axios as unknown as { post: jest.Mock }).post = jest.fn();
  });

  describe("login", () => {
    it("logs in, follows the post-login redirect, and returns the rotated form_key", async () => {
      mockAxios.get
        .mockResolvedValueOnce({
          data: LOGIN_PAGE_HTML,
          headers: { "set-cookie": ["admin=initial123; path=/; HttpOnly"] },
        })
        .mockResolvedValueOnce({
          data: DASHBOARD_HTML,
          headers: { "set-cookie": ["form_key=deleted; expires=Thu, 01-Jan-1970"] },
        });
      mockAxios.post.mockResolvedValue({
        status: 302,
        headers: {
          location: `${BASE_URL}admin/admin/dashboard/index/key/secretkey/`,
          "set-cookie": ["admin=authenticated456; path=/; HttpOnly"],
        },
      });

      const session = await login(BASE_URL, "admin", "correct-password");

      expect(mockAxios.get).toHaveBeenNthCalledWith(1, `${BASE_URL}admin/admin/auth/login/`, expect.any(Object));
      const postCall = mockAxios.post.mock.calls[0];
      expect(postCall[0]).toBe(`${BASE_URL}admin/admin/auth/login/`);
      expect(postCall[1]).toContain("form_key=abc123formkey");
      expect(postCall[1]).toContain("login%5Busername%5D=admin");

      expect(mockAxios.get).toHaveBeenNthCalledWith(
        2,
        `${BASE_URL}admin/admin/dashboard/index/key/secretkey/`,
        expect.any(Object)
      );
      // Later cookie values win (session ID rotation), and an explicit expiry
      // ("form_key=deleted") is still tracked the same way a real jar would.
      expect(session.cookie).toBe("admin=authenticated456; form_key=deleted");
      expect(session.formKey).toBe("rotatedformkey");
    });

    it("throws when Magento redirects back to the login page (bad credentials)", async () => {
      mockAxios.get.mockResolvedValue({
        data: LOGIN_PAGE_HTML,
        headers: { "set-cookie": ["admin=initial123; path=/; HttpOnly"] },
      });
      mockAxios.post.mockResolvedValue({
        status: 302,
        headers: { location: "/admin/admin/auth/login/" },
      });

      await expect(login(BASE_URL, "admin", "wrong-password")).rejects.toThrow(/login failed/i);
    });

    it("throws when the login page has no form_key", async () => {
      mockAxios.get.mockResolvedValue({ data: "<html>no form key here</html>", headers: {} });

      await expect(login(BASE_URL, "admin", "whatever")).rejects.toThrow(/form_key/i);
    });
  });

  describe("setProductStatusAllStores", () => {
    const session = { cookie: "admin=authenticated456", formKey: "rotatedformkey" };

    it("posts the mass-status update with store_id 0", async () => {
      mockAxios.post.mockResolvedValue({ status: 200, headers: {} });

      await setProductStatusAllStores(BASE_URL, session, 2047, 2);

      const [url, body, config] = mockAxios.post.mock.calls[0];
      expect(url).toBe(`${BASE_URL}admin/catalog/product/massStatus/`);
      expect(body).toContain("namespace=product_listing");
      expect(body).toContain("selected%5B%5D=2047");
      expect(body).toContain("status=2");
      expect(config.headers.Cookie).toBe(session.cookie);
    });

    it("throws when the response redirects back to the login page", async () => {
      mockAxios.post.mockResolvedValue({ status: 302, headers: { location: "/admin/admin/auth/login/" } });

      await expect(setProductStatusAllStores(BASE_URL, session, 2047, 2)).rejects.toThrow(/not authenticated/i);
    });

    it("throws on an error status code", async () => {
      mockAxios.post.mockResolvedValue({ status: 500, headers: {} });

      await expect(setProductStatusAllStores(BASE_URL, session, 2047, 2)).rejects.toThrow(/500/);
    });
  });
});
