import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { CategoryGetParams } from "../types/request";

interface MagentoCategory {
  id: number;
  name: string;
  parent_id: number;
  is_active: boolean;
  custom_attributes?: { attribute_code: string; value: unknown }[];
}

export async function main(params: CategoryGetParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    // GET requests pass params as query-string values, so categoryId arrives
    // as a string (e.g. "54") even though the frontend sends a number.
    const categoryId = Number(params.categoryId);
    if (!params.categoryId || Number.isNaN(categoryId)) {
      return actionErrorResponse(HttpStatus.BAD_REQUEST, "Missing categoryId");
    }

    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const category = await client.get<MagentoCategory>(`/categories/${categoryId}`);
    // The tree endpoint used by category/list doesn't expose custom_attributes
    // at all (confirmed by testing directly), so is_anchor's current value can
    // only be read via this single-category fetch - used to pre-fill the Edit
    // dialog's Anchor checkbox correctly.
    const isAnchor = category.custom_attributes?.find((attr) => attr.attribute_code === "is_anchor")?.value;

    return successResponse("Category", {
      category: {
        id: category.id,
        name: category.name,
        parentId: category.parent_id,
        isActive: category.is_active,
        isAnchor: isAnchor === "1" || isAnchor === true,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
