import { Core } from "@adobe/aio-sdk";
import { Logger } from "./types/logger";

let loggerInstance: Logger | null = null;

/**
 * Initialize the category consumer logger
 * @param logLevel - The log level to use (defaults to "debug")
 */
export function initializeLogger(loggerName: string, logLevel: string = "debug"): void {
  if (!loggerInstance) {
    loggerInstance = Core.Logger(loggerName, { level: logLevel });
  }
}

/**
 * Initialize the category consumer logger
 * @param logLevel - The log level to use (defaults to "debug")
 */
export function initializeTestLogger(): void {
  loggerInstance = {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;
}

/**
 * Get the initialized logger instance
 * @throws Error if logger is not initialized
 */
export function log(): Logger {
  if (!loggerInstance) {
    throw new Error("Logger not initialized. Call initializeLogger() first.");
  }
  return loggerInstance;
}

/**
 * Log an info message
 * @param message - The message to log
 * @throws Error if logger is not initialized
 */
export function logInfo(message: string): void {
  if (!loggerInstance) {
    throw new Error("Logger not initialized. Call initializeLogger() first.");
  }
  loggerInstance.info(message);
}

/**
 * Log a debug message
 * @param message - The message to log
 * @throws Error if logger is not initialized
 */
export function logDebug(message: string): void {
  if (!loggerInstance) {
    throw new Error("Logger not initialized. Call initializeLogger() first.");
  }
  loggerInstance.debug(message);
}

/**
 * Log an error message
 * @param message - The message to log
 * @throws Error if logger is not initialized
 */
export function logError(message: string): void {
  if (!loggerInstance) {
    throw new Error("Logger not initialized. Call initializeLogger() first.");
  }
  loggerInstance.error(message);
}
