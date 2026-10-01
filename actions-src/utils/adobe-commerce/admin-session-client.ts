import axios from "axios";

export interface AdminSession {
  cookie: string;
  formKey: string;
}

/**
 * A minimal cookie jar: later Set-Cookie values for the same name overwrite earlier
 * ones (matching real browser/PHP session semantics), which matters here since
 * Magento's login response sends multiple Set-Cookie headers for the same cookie
 * name (session ID rotation) plus explicit expiries (e.g. "form_key=deleted") that
 * a naive concatenation would otherwise keep alive.
 */
class CookieJar {
  private cookies = new Map<string, string>();

  merge(setCookieHeaders: string[] | undefined): void {
    for (const entry of setCookieHeaders ?? []) {
      const pair = entry.split(";")[0];
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) continue;
      this.cookies.set(pair.substring(0, separatorIndex).trim(), pair.substring(separatorIndex + 1).trim());
    }
  }

  toHeader(): string {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

function extractFormKey(html: string): string {
  const hiddenInputMatch = html.match(/name="form_key"\s+type="hidden"\s+value="([^"]+)"/);
  if (hiddenInputMatch) {
    return hiddenInputMatch[1];
  }
  // Every authenticated admin page also embeds it as a global JS variable, used
  // here after login since the pre-login page's form_key doesn't carry over -
  // Magento rotates it (and the session cookie) on successful authentication.
  const jsVarMatch = html.match(/FORM_KEY\s*=\s*'([^']+)'/);
  if (jsVarMatch) {
    return jsVarMatch[1];
  }
  throw new Error("Could not find a form_key on the Magento admin page");
}

function isLoginRedirect(location: unknown): boolean {
  return typeof location === "string" && /auth\/login/i.test(location);
}

/**
 * Logs into the Magento Admin as a real admin user (cookie session + CSRF form_key),
 * the only way to write attribute values to the "All Store Views" scope (store_id 0) -
 * Magento's public REST API has no equivalent (see actions-src/product/update).
 *
 * Three round-trips, matching what a real browser does: (1) GET the login page for
 * its anonymous form_key, (2) POST credentials, (3) follow Magento's post-login
 * redirect to reach a real authenticated page and scrape the *rotated* form_key -
 * reusing the pre-login one fails CSRF validation on the next request.
 */
export async function login(baseUrl: string, username: string, password: string): Promise<AdminSession> {
  const loginUrl = `${baseUrl}admin/admin/auth/login/`;
  const jar = new CookieJar();

  const loginPage = await axios.get(loginUrl, { maxRedirects: 0, validateStatus: () => true });
  jar.merge(loginPage.headers["set-cookie"]);
  const initialFormKey = extractFormKey(loginPage.data);

  const credentialsBody = new URLSearchParams({
    "login[username]": username,
    "login[password]": password,
    form_key: initialFormKey,
  }).toString();

  const loginResult = await axios.post(loginUrl, credentialsBody, {
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.toHeader() },
    maxRedirects: 0,
    validateStatus: () => true,
  });
  jar.merge(loginResult.headers["set-cookie"]);

  if (isLoginRedirect(loginResult.headers.location) || typeof loginResult.headers.location !== "string") {
    throw new Error("Magento admin login failed - check COMMERCE_ADMIN_USERNAME/COMMERCE_ADMIN_PASSWORD");
  }

  // Admin GET routes are protected by a per-session secret key in the URL path;
  // requesting one without it 302s to a valid key'd URL (Magento's own redirect
  // target from login already has this), which is a real 200 page we can scrape.
  const authenticatedPage = await axios.get(loginResult.headers.location, {
    headers: { Cookie: jar.toHeader() },
    maxRedirects: 0,
    validateStatus: () => true,
  });
  jar.merge(authenticatedPage.headers["set-cookie"]);

  return { cookie: jar.toHeader(), formKey: extractFormKey(authenticatedPage.data) };
}

/**
 * Sets a product's status at the "All Store Views" scope (store_id 0) via the same
 * internal controller Magento's Admin grid uses for its "Actions -> Change status"
 * mass action (Magento\Catalog\Controller\Adminhtml\Product\MassStatus) - not a
 * public/versioned API, so this is inherently best-effort. Omitting the "store"
 * param (as the real grid action does by default) makes Magento default to store_id
 * 0, i.e. "All Store Views" - confirmed by reading that controller's source directly.
 */
export async function setProductStatusAllStores(
  baseUrl: string,
  session: AdminSession,
  entityId: number,
  status: number
): Promise<void> {
  const saveUrl = `${baseUrl}admin/catalog/product/massStatus/`;

  const body = new URLSearchParams();
  body.append("form_key", session.formKey);
  body.append("namespace", "product_listing");
  body.append("selected[]", String(entityId));
  body.append("status", String(status));

  const response = await axios.post(saveUrl, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: session.cookie,
    },
    maxRedirects: 0,
    validateStatus: () => true,
  });

  if (isLoginRedirect(response.headers.location)) {
    throw new Error("Magento admin session was not authenticated when saving product status");
  }
  if (response.status >= 400) {
    throw new Error(`Magento admin mass-status update failed with status ${response.status}`);
  }
}
