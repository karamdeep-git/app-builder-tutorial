import stateLib, { AdobeState } from "@adobe/aio-lib-state";
import { logError, logInfo } from "../../logger";

let stateClient: AdobeState | null = null;

enum Region {
  /** North, Central, and South America. Data is stored in the US. */
  amer = "amer",
  /** Asia and Pacific. Data is stored in Japan. */
  apac = "apac",
  /** Europe, the Middle East, and Africa. Data is stored in the EU. */
  emea = "emea",
}

/**
 * Initialize the state client
 *
 * @param options Options for state client initialization
 * @returns State client
 */
export async function getStateClient(options: { region?: string } = {}): Promise<AdobeState> {
  if (!stateClient) {
    try {
      stateClient = await stateLib.init({
        region: options.region || Region.emea,
      });
      logInfo("State client initialized successfully");
    } catch (error) {
      logError("Failed to initialize state client: " + String(error));
      throw new Error(`State initialization failed: ${String(error)}`);
    }
  }
  return stateClient;
}
