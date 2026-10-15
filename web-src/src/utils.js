/* global fetch */

/**
 * Invokes a web action
 *
 * @param {string} actionUrl
 * @param {object} headers
 * @param {object} params
 * @param {object} options
 * @returns {Promise<string|object>} the response
 */
async function actionWebInvoke(actionUrl, headers = {}, params = {}, options = { method: "POST" }) {
  const actionHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  const fetchConfig = {
    headers: actionHeaders,
  };

  if (window.location.hostname === "localhost") {
    actionHeaders["x-ow-extra-logging"] = "on";
  }

  fetchConfig.method = options.method.toUpperCase();

  if (fetchConfig.method === "GET") {
    actionUrl = new URL(actionUrl);
    Object.keys(params).forEach((key) => actionUrl.searchParams.append(key, params[key]));
  } else if (fetchConfig.method === "POST") {
    fetchConfig.body = JSON.stringify(params);
  }

  const response = await fetch(actionUrl, fetchConfig);

  let content = await response.text();

  if (!response.ok) {
    throw new Error(`failed request to '${actionUrl}' with status: ${response.status} and message: ${content}`);
  }
  try {
    content = JSON.parse(content);
  } catch (e) {
    // response is not json
  }
  return content;
}

/**
 * Human-readable reason for a failed actionWebInvoke call.
 *
 * actionWebInvoke throws "failed request to '<url>' with status: N and
 * message: <body>". Every action answers failures with
 * {success: false, error: "..."} (see actions-src/utils/adobe-commerce/errors.ts),
 * and the Adobe IMS validator with {error: "..."} - show that reason (e.g.
 * Magento's "You can't cancel this order.") instead of the raw URL and status.
 *
 * @param {Error} e the error thrown by actionWebInvoke
 * @returns {string} the message to show the admin
 */
export function describeError(e) {
  const match = /and message: ([\s\S]*)$/.exec(e?.message ?? "");
  if (match) {
    try {
      const body = JSON.parse(match[1]);
      if (typeof body?.error === "string") return body.error;
    } catch (parseError) {
      // not JSON - fall through to the raw message
    }
  }
  return e?.message ?? "Something went wrong.";
}

export default actionWebInvoke;
