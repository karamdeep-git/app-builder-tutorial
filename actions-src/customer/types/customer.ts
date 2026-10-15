// Shapes returned by Magento's default customer REST API
// (Magento\Customer\Api\Data\CustomerInterface / AddressInterface, 2.4.7).
// Only the fields this app reads are listed.

export interface MagentoCustomerAddress {
  id?: number;
  firstname?: string;
  lastname?: string;
  company?: string;
  street?: string[];
  city?: string;
  // Unlike order addresses (a plain string), customer addresses nest region.
  region?: { region?: string; region_code?: string; region_id?: number };
  postcode?: string;
  country_id?: string;
  telephone?: string;
  default_billing?: boolean;
  default_shipping?: boolean;
}

export interface MagentoCustomer {
  id: number;
  email: string;
  firstname: string;
  lastname: string;
  group_id: number;
  website_id: number;
  store_id?: number;
  created_in?: string;
  created_at?: string;
  updated_at?: string;
  dob?: string;
  gender?: number;
  addresses?: MagentoCustomerAddress[];
}

export interface CustomerListItem {
  id: number;
  name: string;
  email: string;
  groupId: number;
  websiteId: number;
  createdAt: string | null;
}

export interface CustomerAddress {
  id: number | null;
  name: string;
  company: string | null;
  street: string[];
  city: string | null;
  region: string | null;
  postcode: string | null;
  countryId: string | null;
  telephone: string | null;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
}

export interface CustomerDetail extends CustomerListItem {
  firstname: string;
  lastname: string;
  storeId: number | null;
  createdIn: string | null;
  updatedAt: string | null;
  dob: string | null;
  gender: number | null;
  addresses: CustomerAddress[];
}

function fullName(firstname?: string, lastname?: string): string {
  return `${firstname ?? ""} ${lastname ?? ""}`.trim();
}

/** Just the columns the list shows - never ship whole customer records (addresses, DOB) to a grid. */
export function toCustomerListItem(customer: MagentoCustomer): CustomerListItem {
  return {
    id: customer.id,
    name: fullName(customer.firstname, customer.lastname) || "-",
    email: customer.email,
    groupId: customer.group_id,
    websiteId: customer.website_id,
    createdAt: customer.created_at ?? null,
  };
}

export function toCustomerDetail(customer: MagentoCustomer): CustomerDetail {
  return {
    ...toCustomerListItem(customer),
    firstname: customer.firstname,
    lastname: customer.lastname,
    storeId: customer.store_id ?? null,
    createdIn: customer.created_in ?? null,
    updatedAt: customer.updated_at ?? null,
    dob: customer.dob ?? null,
    gender: customer.gender ?? null,
    addresses: (customer.addresses ?? []).map((address) => ({
      id: address.id ?? null,
      name: fullName(address.firstname, address.lastname),
      company: address.company ?? null,
      street: address.street ?? [],
      city: address.city ?? null,
      region: address.region?.region ?? address.region?.region_code ?? null,
      postcode: address.postcode ?? null,
      countryId: address.country_id ?? null,
      telephone: address.telephone ?? null,
      isDefaultBilling: address.default_billing === true,
      isDefaultShipping: address.default_shipping === true,
    })),
  };
}
