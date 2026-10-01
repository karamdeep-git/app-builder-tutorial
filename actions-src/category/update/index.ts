import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { CategoryUpdateParams } from "../types/request";

export async function main(params: CategoryUpdateParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (typeof params.categoryId !== "number") {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing categoryId");
    }
    if (params.name !== undefined && !params.name.trim()) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Category name cannot be empty");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    // Magento's category save merges whatever fields are sent - no need to
    // fetch-then-reconstruct the full payload the way product updates do.
    const updated = await client.put(`/categories/${params.categoryId}`, {
      category: {
        id: params.categoryId,
        ...(params.name !== undefined ? { name: params.name.trim() } : {}),
        ...(params.isActive !== undefined ? { is_active: params.isActive } : {}),
        // Same custom_attribute convention as category/create - see its
        // comment for why this isn't a top-level field.
        ...(params.isAnchor !== undefined
          ? { custom_attributes: [{ attribute_code: "is_anchor", value: params.isAnchor ? "1" : "0" }] }
          : {}),
      },
    });

    return successResponse("Category updated", { category: updated });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
