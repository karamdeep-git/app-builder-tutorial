import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, actionSuccessResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { CategoryDeleteParams } from "../types/request";

export async function main(params: CategoryDeleteParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (typeof params.categoryId !== "number") {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing categoryId");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    // Magento cascades this to any subcategories automatically (confirmed by
    // testing directly) - the frontend's confirmation dialog is what actually
    // warns the user about that, this action just reflects Magento's own
    // behavior/errors as-is (e.g. its own 400 if someone targets the
    // protected root category).
    await client.delete(`/categories/${params.categoryId}`);

    return actionSuccessResponse("Category deleted");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
