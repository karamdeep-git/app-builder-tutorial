import { initializeLogger } from "../../logger";
import { successResponse } from "../../responses";
import { AppResponse } from "../../types/request";
import { AdobeCommerceClient } from "../../utils/adobe-commerce/adobe-commerce-client";
import { commerceErrorResponse } from "../../utils/adobe-commerce/errors";
import { CategoryListParams } from "../types/request";

interface MagentoCategoryTreeNode {
  id: number;
  name: string;
  parent_id: number;
  is_active: boolean;
  children_data?: MagentoCategoryTreeNode[];
}

export interface FlatCategory {
  id: number;
  name: string;
  parentId: number;
  isActive: boolean;
  level: number;
}

/**
 * Flattens Magento's category tree depth-first, starting from (and including)
 * the root "Default Category" itself at level 0 - unlike product/categories'
 * flatten (which skips the root, since products can't be assigned to it),
 * category management needs the root selectable as a parent for top-level
 * categories.
 */
function flattenCategories(node: MagentoCategoryTreeNode, level = 0): FlatCategory[] {
  return [
    { id: node.id, name: node.name, parentId: node.parent_id, isActive: node.is_active, level },
    ...(node.children_data ?? []).flatMap((child) => flattenCategories(child, level + 1)),
  ];
}

export async function main(params: CategoryListParams): Promise<AppResponse> {
  initializeLogger("process-function");

  try {
    const client = AdobeCommerceClient.create(params, {
      storeCode: "default",
      storeUrl: params.COMMERCE_BASE_URL,
    });

    const root = await client.get<MagentoCategoryTreeNode>("/categories");
    const categories = flattenCategories(root);

    return successResponse("Categories", { categories });
  } catch (error: unknown) {
    return commerceErrorResponse(error, "Category list");
  }
}
