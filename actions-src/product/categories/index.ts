import { initializeLogger, logError } from "../../logger";
import { actionErrorResponse, successResponse } from "../../responses";
import { AppResponse, HttpStatus } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { ProductCategoriesParams } from "../types/request";

interface MagentoCategoryTreeNode {
  id: number;
  name: string;
  parent_id: number;
  children_data?: MagentoCategoryTreeNode[];
}

export interface FlatCategory {
  id: number;
  name: string;
  level: number;
}

/**
 * Flattens Magento's category tree depth-first, skipping the synthetic root
 * ("Default Category") - merchants pick from real categories, not the
 * invisible root. `level` is relative to the root's direct children (0-based).
 */
function flattenCategories(nodes: MagentoCategoryTreeNode[], level = 0): FlatCategory[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, level },
    ...flattenCategories(node.children_data ?? [], level + 1),
  ]);
}

export async function main(params: ProductCategoriesParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const root = await client.get<MagentoCategoryTreeNode>("/categories");
    const categories = flattenCategories(root.children_data ?? []);

    return successResponse("Categories", { categories });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(`Server error: ${errorMessage}`);
    return actionErrorResponse(HttpStatus.INTERNAL_ERROR, `Request failed: ${errorMessage}`);
  }
}
