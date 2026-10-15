import { buildSearchCriteriaQuery } from "../actions-src/utils/adobe-commerce/search-criteria";

describe("buildSearchCriteriaQuery", () => {
  it("ORs filters within a group and indexes groups separately", () => {
    const query = buildSearchCriteriaQuery({
      filterGroups: [
        [
          { field: "email", value: "%ro%", conditionType: "like" },
          { field: "firstname", value: "%ro%", conditionType: "like" },
        ],
        [{ field: "group_id", value: "1", conditionType: "eq" }],
      ],
    });

    expect(query.split("&")).toEqual([
      "searchCriteria[filter_groups][0][filters][0][field]=email",
      "searchCriteria[filter_groups][0][filters][0][value]=%25ro%25",
      "searchCriteria[filter_groups][0][filters][0][condition_type]=like",
      "searchCriteria[filter_groups][0][filters][1][field]=firstname",
      "searchCriteria[filter_groups][0][filters][1][value]=%25ro%25",
      "searchCriteria[filter_groups][0][filters][1][condition_type]=like",
      "searchCriteria[filter_groups][1][filters][0][field]=group_id",
      "searchCriteria[filter_groups][1][filters][0][value]=1",
      "searchCriteria[filter_groups][1][filters][0][condition_type]=eq",
    ]);
  });

  it("encodes values but leaves the bracketed keys literal (oauth-1.0a signs raw keys)", () => {
    const query = buildSearchCriteriaQuery({
      filterGroups: [[{ field: "email", value: "a+b@example.com & co", conditionType: "eq" }]],
    });

    expect(query).toContain("searchCriteria[filter_groups][0][filters][0][value]=a%2Bb%40example.com%20%26%20co");
    expect(query).not.toContain("%5B");
  });

  it("adds sort orders and paging", () => {
    expect(
      buildSearchCriteriaQuery({ sortOrders: [{ field: "created_at", direction: "DESC" }], pageSize: 20, currentPage: 3 })
    ).toBe(
      "searchCriteria[sortOrders][0][field]=created_at&searchCriteria[sortOrders][0][direction]=DESC&searchCriteria[pageSize]=20&searchCriteria[currentPage]=3"
    );
  });

  it("returns an empty string for empty criteria", () => {
    expect(buildSearchCriteriaQuery({})).toBe("");
  });
});
