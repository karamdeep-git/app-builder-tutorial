import React, { useEffect, useState } from "react";
import {
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
import { useSearchParams } from "react-router-dom";

import allActions from "../config.json";
import actionWebInvoke from "../utils";
import OrderDetail from "./OrderDetail";

const actions = Object.keys(allActions).reduce((obj, key) => {
  if (key.lastIndexOf("/") > -1) {
    obj[key] = allActions[key];
  }
  return obj;
}, {});

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

// Magento's default install statuses (confirmed live against this store's
// Sales > Order Status configuration) - there is no default Commerce REST
// endpoint that lists all configured statuses, only one that returns a
// single order's current status, so this filter list is static reference
// data rather than fetched. A merchant-added custom status won't appear
// here, same spirit as the "Salable Quantity" simplification on Products.
const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "processing", label: "Processing" },
  { value: "payment_review", label: "Payment Review" },
  { value: "fraud", label: "Suspected Fraud" },
  { value: "complete", label: "Complete" },
  { value: "closed", label: "Closed" },
  { value: "holded", label: "On Hold" },
  { value: "canceled", label: "Canceled" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_VARIANT = {
  complete: "positive",
  processing: "positive",
  canceled: "negative",
  rejected: "negative",
  holded: "warning",
  payment_review: "warning",
  fraud: "negative",
};

const PAYMENT_STATUS_VARIANT = {
  Paid: "positive",
  "Partially Paid": "warning",
  Pending: "neutral",
  Refunded: "neutral",
};

function formatMoney(amount, currencyCode) {
  if (typeof amount !== "number") return "-";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode || "USD" }).format(amount);
  } catch (e) {
    return `${amount.toFixed(2)} ${currencyCode ?? ""}`.trim();
  }
}

// Magento stores created_at as "YYYY-MM-DD HH:mm:ss" UTC with no zone marker -
// see ProductList's formatDate for why this reshaping is needed.
function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatStatusLabel(status) {
  if (!status) return "-";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// buttonLabel is used for the dialog title and the confirm button itself;
// sentenceVerb is used only inside "Are you sure you want to ... order #X?" -
// kept separate because "release the hold on" reads fine mid-sentence but
// would look broken as a standalone button label.
const ACTION_LABELS = {
  cancel: { buttonLabel: "Cancel Order", sentenceVerb: "cancel", pastTense: "canceled", actionKey: "order/cancel" },
  hold: { buttonLabel: "Hold Order", sentenceVerb: "hold", pastTense: "held", actionKey: "order/hold" },
  unhold: {
    buttonLabel: "Release Hold",
    sentenceVerb: "release the hold on",
    pastTense: "released from hold",
    actionKey: "order/unhold",
  },
};

function OrderList({ ims }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [searchInputValue, setSearchInputValue] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fetchingOrderId, setFetchingOrderId] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmingAction, setConfirmingAction] = useState(null);
  // Bumped after a status-changing action so the effect below refetches the
  // current page, without duplicating its fetch logic in a second function.
  const [reloadToken, setReloadToken] = useState(0);

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  useEffect(() => {
    setPage(1);
  }, [activeSearchQuery, statusFilter, dateFrom, dateTo, pageSize]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await actionWebInvoke(
          actions["order/search"],
          authHeaders,
          { query: activeSearchQuery, status: statusFilter, dateFrom, dateTo, page, pageSize },
          { method: "GET" }
        );
        if (!cancelled) {
          setItems(result?.response?.items ?? []);
          setTotalCount(result?.response?.totalCount ?? 0);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSearchQuery, statusFilter, dateFrom, dateTo, page, pageSize, reloadToken, ims?.token]);

  async function loadOrderDetail(idParams) {
    const result = await actionWebInvoke(actions["order/get"], authHeaders, idParams, { method: "GET" });
    return result?.response;
  }

  async function handleViewClick(orderId) {
    setError(null);
    setFetchingOrderId(orderId);
    try {
      const detail = await loadOrderDetail({ orderId });
      setViewingOrder(detail);
    } catch (e) {
      setError(e.message);
    } finally {
      setFetchingOrderId(null);
    }
  }

  // Arriving from a notification (e.g. /orders?openOrderIncrementId=000000012)
  // - order notifications only ever carry increment_id (Magento's event
  // payload omits entity_id), so this goes through order/get's incrementId
  // lookup instead of handleViewClick's orderId path. Opens the order's
  // detail once, then drops the param so a later refresh/back-nav doesn't
  // keep reopening it.
  useEffect(() => {
    const openOrderIncrementId = searchParams.get("openOrderIncrementId");
    if (openOrderIncrementId) {
      setError(null);
      loadOrderDetail({ incrementId: openOrderIncrementId })
        .then(setViewingOrder)
        .catch((e) => setError(e.message));
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleSearchSubmit(value) {
    setActiveSearchQuery(value.trim());
  }

  function handleSearchClear() {
    setSearchInputValue("");
    setActiveSearchQuery("");
  }

  function handleClearFilters() {
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  }

  async function handleActionConfirmed() {
    if (!confirmingAction) return;
    const { orderId, action } = confirmingAction;
    const { actionKey } = ACTION_LABELS[action];

    setIsActionLoading(true);
    setActionError(null);
    setMessage(null);
    try {
      await actionWebInvoke(actions[actionKey], authHeaders, { orderId }, { method: "POST" });
      setMessage(`Order #${confirmingAction.incrementId} ${ACTION_LABELS[action].pastTense}.`);
      setConfirmingAction(null);
      // Refresh both the open detail dialog (new state/status history) and
      // the list row behind it (new status column) from the one action. Guard
      // against the admin closing this dialog (or opening a different order)
      // before this refetch resolves - a stale response must never clobber
      // whatever order is actually showing by the time it arrives.
      const refreshed = await loadOrderDetail({ orderId });
      setViewingOrder((current) => (current && current.order.entity_id === orderId ? refreshed : current));
      setReloadToken((t) => t + 1);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setIsActionLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <View width="100%" maxWidth="size-8000">
      <Flex direction="row" justifyContent="space-between" alignItems="center" marginBottom="size-200">
        <Heading level={1}>Orders</Heading>
        <SearchField
          aria-label="Search orders by number, customer name, or email"
          placeholder="Search by order #, name, or email"
          value={searchInputValue}
          onChange={setSearchInputValue}
          onSubmit={handleSearchSubmit}
          onClear={handleSearchClear}
          width="100%"
          maxWidth="size-3400"
        />
      </Flex>

      <div className="admin-grid-filterbar">
        <label>
          <Text>Status</Text>
          <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Text>From</Text>
          <input type="date" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label>
          <Text>To</Text>
          <input type="date" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        {(statusFilter || dateFrom || dateTo) && (
          <button type="button" className="admin-grid-arrow" onClick={handleClearFilters}>
            Clear filters
          </button>
        )}
      </div>

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
              aria-label={activeSearchQuery ? "Searching orders" : "Loading orders"}
              isIndeterminate
            />
            <Text>{activeSearchQuery ? "Searching orders..." : "Loading orders..."}</Text>
          </Flex>
        </View>
      )}

      {!isLoading && items.length === 0 ? (
        <IllustratedMessage>
          <Content>
            {activeSearchQuery || statusFilter || dateFrom || dateTo
              ? "No orders matched your search or filters."
              : "No orders have been placed yet."}
          </Content>
        </IllustratedMessage>
      ) : items.length > 0 ? (
        <>
          <div className="admin-grid-toolbar">
            <Text>{totalCount} records found</Text>
            <Flex direction="row" gap="size-200" alignItems="center">
              <label>
                <Text marginEnd="size-75">Per page</Text>
                <select
                  aria-label="Records per page"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
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
            <table className="admin-grid" aria-label="Orders">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer Name</th>
                  <th>Customer Email</th>
                  <th>Order Date</th>
                  <th>Status</th>
                  <th>Payment Status</th>
                  <th>Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((order) => (
                  <tr key={order.id}>
                    <td>{order.incrementId}</td>
                    <td>{order.customerName}</td>
                    <td>{order.customerEmail}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <span className={`admin-grid-status is-${STATUS_VARIANT[order.status] ?? "neutral"}`}>
                        {formatStatusLabel(order.status)}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-grid-status is-${PAYMENT_STATUS_VARIANT[order.paymentStatus] ?? "neutral"}`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td>{formatMoney(order.grandTotal, order.currencyCode)}</td>
                    <td>
                      <div className="admin-grid-row-actions">
                        <button
                          type="button"
                          onClick={() => handleViewClick(order.id)}
                          disabled={fetchingOrderId === order.id}
                        >
                          {fetchingOrderId === order.id ? "Loading..." : "View"}
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
          setViewingOrder(null);
          setActionError(null);
        }}
      >
        {viewingOrder && (
          <OrderDetail
            order={viewingOrder.order}
            tracks={viewingOrder.tracks}
            isActionLoading={isActionLoading}
            actionError={actionError}
            onRequestCancel={() =>
              setConfirmingAction({ action: "cancel", orderId: viewingOrder.order.entity_id, incrementId: viewingOrder.order.increment_id })
            }
            onRequestHold={() =>
              setConfirmingAction({ action: "hold", orderId: viewingOrder.order.entity_id, incrementId: viewingOrder.order.increment_id })
            }
            onRequestUnhold={() =>
              setConfirmingAction({ action: "unhold", orderId: viewingOrder.order.entity_id, incrementId: viewingOrder.order.increment_id })
            }
            onClose={() => {
              setViewingOrder(null);
              setActionError(null);
            }}
          />
        )}
      </DialogContainer>

      <DialogContainer onDismiss={() => setConfirmingAction(null)}>
        {confirmingAction && (
          <AlertDialog
            title={ACTION_LABELS[confirmingAction.action].buttonLabel}
            variant={confirmingAction.action === "cancel" ? "destructive" : "warning"}
            primaryActionLabel={isActionLoading ? "Working..." : ACTION_LABELS[confirmingAction.action].buttonLabel}
            cancelLabel="Cancel"
            isPrimaryActionDisabled={isActionLoading}
            onPrimaryAction={handleActionConfirmed}
            onCancel={() => setConfirmingAction(null)}
          >
            Are you sure you want to {ACTION_LABELS[confirmingAction.action].sentenceVerb} order #
            {confirmingAction.incrementId}? This action is sent directly to Magento.
          </AlertDialog>
        )}
      </DialogContainer>
    </View>
  );
}

OrderList.propTypes = {
  ims: PropTypes.shape({
    token: PropTypes.string,
    org: PropTypes.string,
    profile: PropTypes.object,
  }),
};

export default OrderList;
