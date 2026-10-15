import React, { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  AlertDialog,
  Content,
  DialogContainer,
  Flex,
  Heading,
  IllustratedMessage,
  ProgressCircle,
  SearchField,
  StatusLight,
  Text,
  View,
} from "@adobe/react-spectrum";
import PropTypes from "prop-types";
import Add from "@spectrum-icons/workflow/Add";

import allActions from "../config.json";
import actionWebInvoke, { describeError } from "../utils";
import CustomerCreateDialog from "./CustomerCreateDialog";
import CustomerDetail from "./CustomerDetail";

const actions = Object.keys(allActions).reduce((obj, key) => {
  if (key.lastIndexOf("/") > -1) {
    obj[key] = allActions[key];
  }
  return obj;
}, {});

// customer/list caps pageSize at 100.
const PAGE_SIZE_OPTIONS = [20, 50, 100];

const EMPTY_OPTIONS = { groups: [], websites: [], storeViews: [], defaultGroupId: null };

// Magento stores created_at as "YYYY-MM-DD HH:mm:ss" UTC with no zone marker -
// see ProductList's formatDate for why this reshaping is needed.
function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium" });
}

function CustomerManager({ ims }) {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [searchInputValue, setSearchInputValue] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [isOptionsLoading, setIsOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState(null);
  const [fetchingCustomerId, setFetchingCustomerId] = useState(null);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  // Bumped after a create/delete so the effect below refetches the current
  // page, without duplicating its fetch logic in a second function.
  const [reloadToken, setReloadToken] = useState(0);

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  useEffect(() => {
    setPage(1);
  }, [activeSearchQuery, pageSize]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await actionWebInvoke(
          actions["customer/list"],
          authHeaders,
          { query: activeSearchQuery, page, pageSize },
          { method: "GET" }
        );
        if (!cancelled) {
          setItems(result?.response?.items ?? []);
          setTotalCount(result?.response?.totalCount ?? 0);
        }
      } catch (e) {
        if (!cancelled) setError(describeError(e));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSearchQuery, page, pageSize, reloadToken, ims?.token]);

  // Groups/websites/store views: names for the list's columns and the
  // choices in the Add Customer form.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsOptionsLoading(true);
      setOptionsError(null);
      try {
        const result = await actionWebInvoke(actions["customer/options"], authHeaders, {}, { method: "GET" });
        if (!cancelled) setOptions({ ...EMPTY_OPTIONS, ...result?.response });
      } catch (e) {
        if (!cancelled) setOptionsError(describeError(e));
      } finally {
        if (!cancelled) setIsOptionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ims?.token]);

  const groupNames = useMemo(() => new Map(options.groups.map((group) => [group.id, group.code])), [options.groups]);
  const websiteNames = useMemo(
    () => new Map(options.websites.map((website) => [website.id, website.name])),
    [options.websites]
  );

  async function handleViewClick(customerId) {
    setError(null);
    setFetchingCustomerId(customerId);
    try {
      const result = await actionWebInvoke(actions["customer/get"], authHeaders, { customerId }, { method: "GET" });
      setViewingCustomer(result?.response?.customer ?? null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setFetchingCustomerId(null);
    }
  }

  function handleSearchSubmit(value) {
    setActiveSearchQuery(value.trim());
  }

  function handleSearchClear() {
    setSearchInputValue("");
    setActiveSearchQuery("");
  }

  async function handleCreate(data) {
    if (isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    setMessage(null);
    try {
      const result = await actionWebInvoke(actions["customer/create"], authHeaders, { data }, { method: "POST" });
      setIsCreateOpen(false);
      setMessage(
        `Customer ${result?.response?.customer?.email ?? data.email} created. Magento emails them a link to set their password.`
      );
      // The list is newest-first, so the new customer is at the top of page 1.
      setPage(1);
      setReloadToken((t) => t + 1);
    } catch (e) {
      setCreateError(describeError(e));
    } finally {
      setIsCreating(false);
    }
  }

  // AlertDialog closes itself before calling onPrimaryAction, so progress and
  // failure can't be shown in the confirmation - they go to the detail dialog
  // (if it's open for this customer) and the page, like OrderList does.
  async function handleDeleteConfirmed() {
    if (!deletingCustomer || pendingDeleteId !== null) return;
    const customer = deletingCustomer;
    setPendingDeleteId(customer.id);
    setDeleteError(null);
    setError(null);
    setMessage(null);
    try {
      await actionWebInvoke(actions["customer/delete"], authHeaders, { customerId: customer.id }, { method: "POST" });
      setMessage(`Customer ${customer.email} deleted.`);
      setViewingCustomer((current) => (current && current.id === customer.id ? null : current));
      setReloadToken((t) => t + 1);
    } catch (e) {
      const reason = describeError(e);
      setDeleteError(reason);
      setError(`Couldn't delete ${customer.email}: ${reason}`);
    } finally {
      setPendingDeleteId(null);
    }
  }

  function requestDelete(customer) {
    setDeleteError(null);
    setDeletingCustomer({ id: customer.id, name: customer.name, email: customer.email });
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const canCreate = !isOptionsLoading && !optionsError;

  return (
    <View width="100%" maxWidth="size-8000">
      <Flex direction="row" justifyContent="space-between" alignItems="center" marginBottom="size-200">
        <Heading level={1}>Customers</Heading>
        <Flex direction="row" gap="size-150" alignItems="center" wrap="wrap">
          <SearchField
            aria-label="Search customers by name or email"
            placeholder="Search by name or email"
            value={searchInputValue}
            onChange={setSearchInputValue}
            onSubmit={handleSearchSubmit}
            onClear={handleSearchClear}
            width="100%"
            maxWidth="size-3400"
          />
          <ActionButton
            onPress={() => {
              setCreateError(null);
              setIsCreateOpen(true);
            }}
            isDisabled={!canCreate}
          >
            <Add aria-label="Add customer" />
            <Text>Add customer</Text>
          </ActionButton>
        </Flex>
      </Flex>

      {optionsError && (
        <View marginBottom="size-200">
          <StatusLight variant="notice">
            Couldn&apos;t load customer groups and websites ({optionsError}). Group and Website show IDs, and Add
            customer is unavailable until this loads.
          </StatusLight>
        </View>
      )}
      {message && (
        <View marginBottom="size-200">
          <StatusLight variant="positive">{message}</StatusLight>
        </View>
      )}
      {error && (
        <View marginBottom="size-200">
          <StatusLight variant="negative">{error}</StatusLight>
        </View>
      )}

      {isLoading && (
        <View marginBottom="size-200">
          <Flex direction="row" gap="size-100" alignItems="center">
            <ProgressCircle
              size="S"
              aria-label={activeSearchQuery ? "Searching customers" : "Loading customers"}
              isIndeterminate
            />
            <Text>{activeSearchQuery ? "Searching customers..." : "Loading customers..."}</Text>
          </Flex>
        </View>
      )}

      {!isLoading && items.length === 0 && !error ? (
        <IllustratedMessage>
          <Content>
            {activeSearchQuery ? "No customers matched your search." : "No customers have registered yet."}
          </Content>
        </IllustratedMessage>
      ) : items.length > 0 ? (
        <>
          <div className="admin-grid-toolbar">
            <Text>{totalCount} records found</Text>
            <Flex direction="row" gap="size-200" alignItems="center">
              <label>
                <Text marginEnd="size-75">Per page</Text>
                <select aria-label="Records per page" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="admin-grid-arrow"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
              >
                ‹
              </button>
              <Text>
                Page {page} of {totalPages}
              </Text>
              <button
                type="button"
                className="admin-grid-arrow"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                ›
              </button>
            </Flex>
          </div>

          <div className="admin-grid-wrapper">
            <table className="admin-grid" aria-label="Customers">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Group</th>
                  <th>Website</th>
                  <th>Customer Since</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.id}</td>
                    <td>{customer.name}</td>
                    <td>{customer.email}</td>
                    <td>{groupNames.get(customer.groupId) ?? customer.groupId}</td>
                    <td>{websiteNames.get(customer.websiteId) ?? customer.websiteId}</td>
                    <td>{formatDate(customer.createdAt)}</td>
                    <td>
                      <div className="admin-grid-row-actions">
                        <button
                          type="button"
                          onClick={() => handleViewClick(customer.id)}
                          disabled={fetchingCustomerId === customer.id}
                        >
                          {fetchingCustomerId === customer.id ? "Loading..." : "View"}
                        </button>
                        <button
                          type="button"
                          className="is-destructive"
                          onClick={() => requestDelete(customer)}
                          disabled={pendingDeleteId !== null}
                        >
                          {pendingDeleteId === customer.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <DialogContainer
        onDismiss={() => {
          setViewingCustomer(null);
          setDeleteError(null);
        }}
      >
        {viewingCustomer && (
          <CustomerDetail
            customer={viewingCustomer}
            groupName={groupNames.get(viewingCustomer.groupId) ?? String(viewingCustomer.groupId)}
            websiteName={websiteNames.get(viewingCustomer.websiteId) ?? String(viewingCustomer.websiteId)}
            isDeleting={pendingDeleteId === viewingCustomer.id}
            deleteError={deleteError}
            onRequestDelete={() => requestDelete(viewingCustomer)}
            onClose={() => {
              setViewingCustomer(null);
              setDeleteError(null);
            }}
          />
        )}
      </DialogContainer>

      <DialogContainer onDismiss={() => !isCreating && setIsCreateOpen(false)}>
        {isCreateOpen && (
          <CustomerCreateDialog
            options={options}
            isSaving={isCreating}
            error={createError}
            onSave={handleCreate}
            onCancel={() => setIsCreateOpen(false)}
          />
        )}
      </DialogContainer>

      <DialogContainer onDismiss={() => setDeletingCustomer(null)}>
        {deletingCustomer && (
          <AlertDialog
            title="Delete customer"
            variant="destructive"
            primaryActionLabel="Delete"
            cancelLabel="Cancel"
            isPrimaryActionDisabled={pendingDeleteId !== null}
            onPrimaryAction={handleDeleteConfirmed}
            onCancel={() => setDeletingCustomer(null)}
          >
            Delete {deletingCustomer.name} ({deletingCustomer.email}) from Magento? Their orders are kept but will no
            longer be linked to an account. This can&apos;t be undone.
          </AlertDialog>
        )}
      </DialogContainer>
    </View>
  );
}

CustomerManager.propTypes = {
  ims: PropTypes.shape({
    token: PropTypes.string,
    org: PropTypes.string,
    profile: PropTypes.object,
  }),
};

export default CustomerManager;
