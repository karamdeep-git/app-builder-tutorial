export interface SearchFilter {
  field: string;
  value: string;
  conditionType: "eq" | "neq" | "like" | "gteq" | "lteq" | "in";
}

export interface SearchCriteria {
  /** Filters inside one group are OR'ed; the groups themselves are AND'ed (Magento's own semantics). */
  filterGroups?: SearchFilter[][];
  sortOrders?: { field: string; direction: "ASC" | "DESC" }[];
  pageSize?: number;
  currentPage?: number;
}

/**
 * Builds a Magento `searchCriteria` query string for any default REST search
 * endpoint (GET /V1/customers/search, /V1/customerGroups/search, ...).
 *
 * Keys are left with literal, unencoded `[`/`]` - see product/search's
 * buildSearchCriteriaQuery for why (oauth-1.0a signs the raw key but
 * percent-encodes it once itself; a pre-encoded key would be double-encoded
 * and invalidate the signature). Only values are encoded.
 */
export function buildSearchCriteriaQuery(criteria: SearchCriteria): string {
  const parts: string[] = [];

  (criteria.filterGroups ?? []).forEach((group, groupIndex) => {
    group.forEach((filter, filterIndex) => {
      const prefix = `searchCriteria[filter_groups][${groupIndex}][filters][${filterIndex}]`;
      parts.push(`${prefix}[field]=${encodeURIComponent(filter.field)}`);
      parts.push(`${prefix}[value]=${encodeURIComponent(filter.value)}`);
      parts.push(`${prefix}[condition_type]=${filter.conditionType}`);
    });
  });

  (criteria.sortOrders ?? []).forEach((sort, index) => {
    parts.push(`searchCriteria[sortOrders][${index}][field]=${encodeURIComponent(sort.field)}`);
    parts.push(`searchCriteria[sortOrders][${index}][direction]=${sort.direction}`);
  });

  if (criteria.pageSize !== undefined) parts.push(`searchCriteria[pageSize]=${criteria.pageSize}`);
  if (criteria.currentPage !== undefined) parts.push(`searchCriteria[currentPage]=${criteria.currentPage}`);

  return parts.join("&");
}
