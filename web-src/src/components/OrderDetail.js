import React from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  Heading,
  Divider,
  Content,
  Flex,
  View,
  Text,
  Button,
  ButtonGroup,
  ProgressCircle,
  StatusLight,
} from "@adobe/react-spectrum";

const TERMINAL_STATES = ["canceled", "complete", "closed"];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(amount, currencyCode) {
  if (typeof amount !== "number") return "-";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode || "USD" }).format(amount);
  } catch (e) {
    return `${amount.toFixed(2)} ${currencyCode ?? ""}`.trim();
  }
}

function formatAddress(address) {
  if (!address) return null;
  const lines = [
    `${address.firstname ?? ""} ${address.lastname ?? ""}`.trim(),
    ...(address.street ?? []),
    `${address.city ?? ""}, ${address.region ?? ""} ${address.postcode ?? ""}`.trim(),
    address.country_id,
    address.telephone,
  ].filter(Boolean);
  return lines;
}

function getShippingAddress(order) {
  return order?.extension_attributes?.shipping_assignments?.[0]?.shipping?.address;
}

function AddressCard({ title, address }) {
  const lines = formatAddress(address);
  return (
    <View flex="1" minWidth="size-3000" borderWidth="thin" borderColor="dark" borderRadius="regular" padding="size-150">
      <Text UNSAFE_style={{ fontWeight: 600 }}>{title}</Text>
      {lines ? (
        lines.map((line, index) => (
          <View key={index}>
            <Text>{line}</Text>
          </View>
        ))
      ) : (
        <Text>Not available</Text>
      )}
    </View>
  );
}

function OrderDetail({ order, tracks, isActionLoading, actionError, onRequestCancel, onRequestHold, onRequestUnhold, onClose }) {
  if (!order) return null;

  const canCancel = !TERMINAL_STATES.includes(order.state) && order.state !== "holded";
  const canHold = !TERMINAL_STATES.includes(order.state) && order.state !== "holded";
  const canUnhold = order.state === "holded";
  const shippingAddress = getShippingAddress(order);
  const shippingMethod = order?.extension_attributes?.shipping_assignments?.[0]?.shipping?.method;

  return (
    <Dialog size="L">
      <Heading>
        Order #{order.increment_id}
        <View UNSAFE_style={{ display: "inline-block" }} marginStart="size-200">
          <StatusLight variant={order.state === "canceled" ? "negative" : order.state === "holded" ? "notice" : "positive"}>
            {order.status}
          </StatusLight>
        </View>
      </Heading>
      <Divider />
      <Content>
        {actionError && (
          <View marginBottom="size-200">
            <StatusLight variant="negative">{actionError}</StatusLight>
          </View>
        )}

        <Flex direction="row" gap="size-400" wrap="wrap" marginBottom="size-200">
          <View>
            <Text UNSAFE_style={{ fontWeight: 600 }}>Order Date</Text>
            <View>
              <Text>{formatDate(order.created_at)}</Text>
            </View>
          </View>
          <View>
            <Text UNSAFE_style={{ fontWeight: 600 }}>Customer</Text>
            <View>
              <Text>
                {`${order.customer_firstname ?? ""} ${order.customer_lastname ?? ""}`.trim() || "Guest"} (
                {order.customer_email ?? "-"})
              </Text>
            </View>
          </View>
        </Flex>

        <Flex direction="row" gap="size-150" marginBottom="size-300">
          {canCancel && (
            <Button variant="negative" onPress={onRequestCancel} isDisabled={isActionLoading}>
              Cancel Order
            </Button>
          )}
          {canHold && (
            <Button variant="secondary" onPress={onRequestHold} isDisabled={isActionLoading}>
              Hold Order
            </Button>
          )}
          {canUnhold && (
            <Button variant="cta" onPress={onRequestUnhold} isDisabled={isActionLoading}>
              Release Hold
            </Button>
          )}
          {isActionLoading && (
            <Flex direction="row" gap="size-75" alignItems="center">
              <ProgressCircle size="S" aria-label="Updating order" isIndeterminate />
              <Text>Updating...</Text>
            </Flex>
          )}
        </Flex>

        <Heading level={4}>Addresses</Heading>
        <Flex direction="row" gap="size-200" wrap="wrap" marginBottom="size-300">
          <AddressCard title="Billing Address" address={order.billing_address} />
          <AddressCard title="Shipping Address" address={shippingAddress} />
        </Flex>

        <Heading level={4}>Items Ordered</Heading>
        <div className="admin-grid-wrapper" style={{ marginBottom: "16px" }}>
          <table className="admin-grid" aria-label="Order items">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Row Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.items ?? [])
                .filter((item) => !item.parent_item_id)
                .map((item) => (
                  <tr key={item.item_id}>
                    <td>{item.sku}</td>
                    <td>{item.name}</td>
                    <td>{item.qty_ordered}</td>
                    <td>{formatMoney(item.price, order.order_currency_code)}</td>
                    <td>{formatMoney(item.row_total, order.order_currency_code)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Flex direction="row" gap="size-400" wrap="wrap" marginBottom="size-300">
          <View>
            <Heading level={4}>Totals</Heading>
            <Text>Subtotal: {formatMoney(order.subtotal, order.order_currency_code)}</Text>
            <View>
              <Text>Discount: {formatMoney(-(order.discount_amount ?? 0), order.order_currency_code)}</Text>
            </View>
            <View>
              <Text>Shipping: {formatMoney(order.shipping_amount, order.order_currency_code)}</Text>
            </View>
            <View>
              <Text>Tax: {formatMoney(order.tax_amount, order.order_currency_code)}</Text>
            </View>
            <View marginTop="size-50">
              <Text UNSAFE_style={{ fontWeight: 600 }}>
                Grand Total: {formatMoney(order.grand_total, order.order_currency_code)}
              </Text>
            </View>
          </View>

          <View>
            <Heading level={4}>Payment</Heading>
            <Text>Method: {order.payment?.method ?? "-"}</Text>
            <View>
              <Text>Paid: {formatMoney(order.total_paid, order.order_currency_code)}</Text>
            </View>
            <View>
              <Text>Due: {formatMoney(order.total_due, order.order_currency_code)}</Text>
            </View>
          </View>

          <View>
            <Heading level={4}>Shipping</Heading>
            <Text>Method: {order.shipping_description ?? shippingMethod ?? "-"}</Text>
            {tracks?.length > 0 ? (
              tracks.map((track, index) => (
                <View key={index}>
                  <Text>
                    {track.title ?? track.carrier_code}: {track.track_number}
                  </Text>
                </View>
              ))
            ) : (
              <View>
                <Text>No tracking information available.</Text>
              </View>
            )}
          </View>
        </Flex>

        <Heading level={4}>Status History</Heading>
        {order.status_histories?.length > 0 ? (
          <div className="admin-grid-wrapper">
            <table className="admin-grid" aria-label="Order status history">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {order.status_histories.map((entry) => (
                  <tr key={entry.entity_id}>
                    <td>{formatDate(entry.created_at)}</td>
                    <td>{entry.status ?? "-"}</td>
                    <td>{entry.comment ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Text>No status history yet.</Text>
        )}
      </Content>
      <ButtonGroup>
        <Button variant="secondary" onPress={onClose}>
          Close
        </Button>
      </ButtonGroup>
    </Dialog>
  );
}

OrderDetail.propTypes = {
  order: PropTypes.object,
  tracks: PropTypes.array,
  isActionLoading: PropTypes.bool,
  actionError: PropTypes.string,
  onRequestCancel: PropTypes.func.isRequired,
  onRequestHold: PropTypes.func.isRequired,
  onRequestUnhold: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default OrderDetail;
