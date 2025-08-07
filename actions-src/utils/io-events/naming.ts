import { AdobeAuthParams } from "../../types/request";
import { providersList } from "./adobe-events-api";

const SEPARATOR = "-";

/**
 * Get label suffix
 *
 * @param {string} runtimeNamespace - runtime namespace
 * @returns {string} - returns the suffix
 */
function labelSuffix(runtimeNamespace: string): string {
  return runtimeNamespace.substring(runtimeNamespace.indexOf(SEPARATOR) + 1);
}

/**
 * Add suffix to a string
 *
 * @param {string} labelPrefix - label prefix
 * @param {object} environment - environment params
 * @returns {string} - returns the string with the suffix
 */
export function addSuffix(labelPrefix: string, environment: AdobeAuthParams): string {
  if (!labelPrefix) {
    throw Error("Cannot add suffix to undefined label");
  }
  if (!environment?.AIO_runtime_namespace) {
    throw Error("Unable to add suffix. AIO_runtime_namespace is undefined in the environment");
  }
  return `${labelPrefix} - ${labelSuffix(environment.AIO_runtime_namespace)}`;
}

/**
 * Capitalize the first char of a given string
 *
 * @param {string} string the text to modify
 * @returns {string} string
 */
function stringToUppercaseFirstChar(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Generate the registration name based on the provider key and entity name
 *
 * @param {string} providerKey provider key
 * @param {string} entityName entity name
 * @returns {string} the generated registration name
 */
export function getRegistrationName(providerKey: string, entityName: string): string {
  return `${stringToUppercaseFirstChar(providerKey)} ${stringToUppercaseFirstChar(entityName)} Sync`;
}

/**
 * Generate the external backoffice provider name
 *
 * @param {object} params action parameters
 * @param {string} providerKey the provider key (could be found in onboarding/config/providers.js)
 * @returns {string} returns the provider name
 */
export function getProviderName(params: AdobeAuthParams, providerKey: string): string {
  const backofficeProvider = providersList.find((provider: { key: string }) => provider.key === providerKey);

  if (!backofficeProvider) {
    throw new Error(`Provider with key '${providerKey}' not found`);
  }

  return addSuffix(backofficeProvider.label, params);
}
