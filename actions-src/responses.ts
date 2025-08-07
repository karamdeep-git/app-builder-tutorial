import { AppResponse, HttpStatus } from "./types/request";

/**
 *
 * Returns a success response object, this method should be called on the handlers actions
 *
 * @param {string} message a descriptive message of the result
 * @returns {AppResponse} the response object, ready to be returned from the action main's function.
 */
export function actionSuccessResponse(message: string): AppResponse {
  return {
    statusCode: HttpStatus.OK,
    body: {
      success: true,
      message,
    },
  };
}

/**
 *
 * Returns a success response object, this method should be called on the handlers actions
 *
 * @param {number} statusCode the status code.
 *        e.g. 400
 * @param {string} error a descriptive message of the result
 *        e.g. 'missing xyz parameter'
 * @returns {AppResponse} the response object, ready to be returned from the action main's function.
 */
export function actionErrorResponse(statusCode: number, error: string): AppResponse {
  return {
    statusCode,
    body: {
      success: false,
      error,
    },
  };
}

/**
 *
 * Returns an error response object, this method should be called on the consumers and public webhooks
 *
 * @param {number} statusCode the error status code.
 *        e.g. 400
 * @param {string} message the error message.
 *        e.g. 'missing xyz parameter'
 * @returns {AppResponse} the error object, ready to be returned from the action main's function.
 */
export function errorResponse(statusCode: number, message: string): AppResponse {
  return {
    statusCode,
    body: {
      error: message,
    },
  };
}

/**
 *
 * Returns a success response object, this method should be called on the consumers
 *
 * @param {string} type the event type received by consumer
 *        e.g. 'adobe.commerce.observer.catalog_product_save_commit_after'
 * @param {object} response the response object returned from the event handler
 *        e.g. '{ success: true, message: 'Product created successfully'}'
 * @returns {AppResponse} the response object, ready to be returned from the action main's function.
 */
export function successResponse(type: string, response: object): AppResponse {
  return {
    statusCode: HttpStatus.OK,
    body: {
      type,
      response,
    },
  };
}

/**
 * Returns response error adapted to ingestion webhooks module
 *
 * @param {string} message the error message.
 *        e.g. 'missing xyz parameter'
 * @returns {AppResponse} the response object, ready to be returned from the action main's function.
 */
export function webhookErrorResponse(message: string): AppResponse {
  return {
    statusCode: HttpStatus.OK,
    body: {
      op: "exception",
      message,
    },
  };
}

/**
 *
 * Returns a success response object, this method should be called on the sync webhooks
 *
 * @returns {AppResponse} the response object, ready to be returned from the action main's function.
 */
export function webhookSuccessResponse(): AppResponse {
  return {
    statusCode: HttpStatus.OK,
    body: {
      op: "success",
    },
  };
}
