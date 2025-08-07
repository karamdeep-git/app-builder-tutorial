import { Events } from "@adobe/aio-sdk";
import { CloudEvent } from "cloudevents";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import { logDebug, logError, logInfo } from "../../logger";
import { AdobeAuthParams } from "../../types/request";
import { getAdobeAccessToken } from "../io-auth/adobe-auth";
import { getProviderName } from "./naming";

export enum EventCode {
  PRODUCT_CREATED = "...",
}

export enum ProviderKey {
  COMMERCE = "commerce",
  BACKOFFICE = "backoffice",
}

export const providersList = [
  {
    key: ProviderKey.COMMERCE.toString(),
    label: "Commerce Provider",
  },
  {
    key: ProviderKey.BACKOFFICE.toString(),
    label: "Backoffice Provider",
  },
];

interface Registration {
  id: string;
  registration_id: string;
  name: string;
  enabled: boolean;
}

interface Provider {
  label: string;
  [key: string]: unknown;
}

/**
 * Publishes an event to Adobe IO Events
 *
 * @param {AdobeAuthParams} params - Adobe authentication parameters
 * @param {unknown} eventData - The event data to publish
 * @param {string} providerKey - The provider key
 * @param {EventCode} eventType - The type of event
 * @throws {Error} Throws an error if the provider is not found or if publishing fails
 */
export async function publishEvent(
  params: AdobeAuthParams,
  eventData: unknown,
  providerKey: ProviderKey,
  eventType: EventCode
) {
  logDebug("Generate Adobe access token");
  const accessToken = await getAdobeAccessToken(params);

  logDebug("Get external provider");
  const provider = await getProviderByKey(params, accessToken, providerKey);

  if (!provider) {
    const errorMessage = "Could not find any external provider";
    logError(`${errorMessage}`);
    throw new Error(errorMessage);
  }

  logDebug("Initiate events client");
  const eventsClient = await Events.init(params.OAUTH_ORG_ID, params.OAUTH_CLIENT_ID, accessToken);

  logInfo(`Process event data ${eventType}`);
  const cloudEvent = new CloudEvent({
    source: "urn:uuid:" + provider.id,
    datacontenttype: "application/json",
    type: eventType,
    data: eventData,
    id: uuidv4(),
  });

  logDebug(`Publish event ${eventType} to provider ${provider.id}`);

  return await eventsClient.publishEvent(cloudEvent);
}

/**
 * Make the API call to IO Events to get the existing registrations
 *
 * @param {Environment} environment includes the needed parameters to call IO Event
 * @param {string} accessToken Adobe OAuth access token
 * @param {?string} next registrations url to get more data
 * @returns {Promise<Registration[]>} returns array of registrations
 * @throws {Error} Throw exception in case the API call fails
 */
async function getExistingRegistrationsData(
  environment: AdobeAuthParams,
  accessToken: string,
  next: string | null = null
): Promise<Registration[]> {
  const url = `${environment.IO_MANAGEMENT_BASE_URL}${environment.IO_CONSUMER_ID}/${environment.IO_PROJECT_ID}/${environment.IO_WORKSPACE_ID}/registrations`;

  const getRegistrationsReq = await fetch(next || url, {
    method: "GET",
    headers: {
      "x-api-key": `${environment.OAUTH_CLIENT_ID}`,
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      Accept: "application/hal+json",
    },
  });
  const getRegistrationsResult = (await getRegistrationsReq.json()) as any;

  const existingRegistrations: Registration[] = [];
  if (getRegistrationsResult?._embedded?.registrations) {
    getRegistrationsResult._embedded.registrations.forEach((registration: Registration) => {
      existingRegistrations.push({
        id: registration.id,
        registration_id: registration.registration_id,
        name: registration.name,
        enabled: registration.enabled,
      });
    });
  }

  if (getRegistrationsResult?._links?.next) {
    existingRegistrations.push(
      ...(await getExistingRegistrationsData(environment, accessToken, getRegistrationsResult._links.next.href))
    );
  }

  return existingRegistrations;
}

/**
 * Get the existing registration for current project
 *
 * @param {Environment} environment includes the needed parameters to call IO Event
 * @param {string} accessToken Adobe OAuth access token
 * @returns {Promise<Record<string, Registration>>} returns array of registrations with the name of the registration as key
 * @throws {Error} Throw exception in case the API call fails
 */
export async function getExistingRegistrations(
  environment: AdobeAuthParams,
  accessToken: string
): Promise<Record<string, Registration>> {
  const existingRegistrationsResult = await getExistingRegistrationsData(environment, accessToken);
  const existingRegistrations: Record<string, Registration> = {};
  existingRegistrationsResult.forEach((item) => {
    existingRegistrations[item.name] = item;
  });
  return existingRegistrations;
}

/**
 * Get the list of existing providers
 *
 * @param {Environment} environment - environment params
 * @param {string} accessToken - access token
 * @returns {Promise<Record<string, Provider>>} - returns the list of providers
 */
export async function getExistingProviders(
  environment: AdobeAuthParams,
  accessToken: string
): Promise<Record<string, Provider>> {
  const getCreatedProvidersReq = await fetch(
    `${environment.IO_MANAGEMENT_BASE_URL}${environment.IO_CONSUMER_ID}/providers`,
    {
      method: "GET",
      headers: {
        "x-api-key": `${environment.OAUTH_CLIENT_ID}`,
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        Accept: "application/hal+json",
      },
    }
  );

  const getCreatedProvidersResult = (await getCreatedProvidersReq.json()) as any;
  const existingProviders: Record<string, Provider> = {};
  if (getCreatedProvidersResult?._embedded?.providers) {
    getCreatedProvidersResult._embedded.providers.forEach((provider: Provider) => {
      existingProviders[provider.label] = provider;
    });
  }
  return existingProviders;
}

/**
 * This method gets the existing provider by its key, the key could be found on the file (onboarding/config/providers.json)
 *
 * @param {Environment} params includes parameters needed to make the call to Adobe IO Events
 * @param {string} accessToken Adobe OAuth access token
 * @param {string} providerKey Provider key used to find the provider
 * @returns {Promise<Provider | undefined>} return IO Event provider
 */
export async function getProviderByKey(
  params: AdobeAuthParams,
  accessToken: string,
  providerKey: string
): Promise<Provider | undefined> {
  const providers = await getExistingProviders(params, accessToken);
  const providerName = getProviderName(params, providerKey);

  return providers[providerName];
}
