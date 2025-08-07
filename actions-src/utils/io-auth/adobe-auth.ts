import { context, getToken } from "@adobe/aio-lib-ims";
import { AdobeAuthParams } from "../../types/request";

/**
 * Generate access token to connect with Adobe tools (e.g. IO Events)
 *
 * @param {AdobeAuthParams} params includes env parameters
 * @returns {Promise<string>} returns the access token
 * @throws {Error} in case of any failure
 */
export const getAdobeAccessToken = async (params: AdobeAuthParams): Promise<string> => {
  const ioManagementAPIScopes = [
    "AdobeID",
    "openid",
    "read_organizations",
    "additional_info.projectedProductContext",
    "additional_info.roles",
    "adobeio_api",
    "read_client_secret",
    "manage_client_secrets",
  ];
  const config = {
    client_id: params.OAUTH_CLIENT_ID,
    client_secrets: [params.OAUTH_CLIENT_SECRET],
    technical_account_id: params.OAUTH_TECHNICAL_ACCOUNT_ID,
    technical_account_email: params.OAUTH_TECHNICAL_ACCOUNT_EMAIL,
    ims_org_id: params.OAUTH_ORG_ID,
    scopes: ioManagementAPIScopes,
  };

  await context.setCurrent("onboarding-config");
  await context.set("onboarding-config", config);

  return await getToken();
};
