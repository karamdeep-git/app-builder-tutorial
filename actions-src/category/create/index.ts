import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { CategoryCreateParams } from "../types/request";

export async function main(params: CategoryCreateParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    if (!params.name?.trim()) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing category name");
    }
    if (typeof params.parentId !== "number") {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing parentId");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const created = await client.post("/categories", {
      category: {
        parent_id: params.parentId,
        name: params.name.trim(),
        is_active: params.isActive ?? true,
        // is_anchor controls whether this category's page also shows products
        // from its subcategories. It's a custom_attribute, not a top-level
        // field, and Magento stores it as the string "1"/"0" rather than a
        // native boolean - confirmed directly against the real API.
        ...(params.isAnchor !== undefined
          ? { custom_attributes: [{ attribute_code: "is_anchor", value: params.isAnchor ? "1" : "0" }] }
          : {}),
      },
    });

    return successResponse("Category created", { category: created });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
