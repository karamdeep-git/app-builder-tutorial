import filesLib, { FilesClient } from "@adobe/aio-lib-files";
import { logError, logInfo } from "../../logger";

let storageClient: FilesClient | null = null;

/**
 * Initialize the storage client for file operations
 *
 * @param options Options for storage client initialization
 * @returns Storage client
 */
export async function getStorageClient(): Promise<FilesClient> {
  if (!storageClient) {
    try {
      storageClient = await filesLib.init();

      logInfo("Storage client initialized successfully");
    } catch (error) {
      logError("Failed to initialize storage client: " + String(error));
      throw new Error(`Storage initialization failed: ${String(error)}`);
    }
  }
  return storageClient;
}
