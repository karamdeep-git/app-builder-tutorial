import React from "react";
import PropTypes from "prop-types";
import {
  ActionButton,
  Badge,
  Content,
  Dialog,
  DialogTrigger,
  Divider,
  Flex,
  Heading,
  IllustratedMessage,
  ProgressCircle,
  Text,
} from "@adobe/react-spectrum";
import Bell from "@spectrum-icons/workflow/Bell";
import { isLowStock, lowStockSummary, lowStockTitle } from "../notificationText";

function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

function formatMoney(amount, currencyCode) {
  if (typeof amount !== "number") return "-";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode || "USD" }).format(amount);
  } catch (e) {
    return `${amount.toFixed(2)} ${currencyCode ?? ""}`.trim();
  }
}

function NotificationBell({
  notifications,
  unreadCount,
  isLoading,
  error,
  onOpenOrder,
  onOpenProducts,
  onMarkRead,
  onMarkAllRead,
}) {
  return (
    // DialogTrigger clones its first child to inject press/aria handlers, so
    // that child must stay the real ActionButton - the badge is positioned
    // via a wrapper placed *around* DialogTrigger instead, not inside it.
    <div style={{ position: "relative", display: "inline-block" }}>
      <DialogTrigger type="popover" placement="bottom end">
        <ActionButton aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`} isQuiet>
          <Bell aria-hidden="true" />
        </ActionButton>
        {(close) => (
          <Dialog width="size-4600">
            <Heading level={4}>Notifications</Heading>
            <Divider />
            <Content>
              {isLoading && notifications.length === 0 ? (
                <Flex direction="row" gap="size-100" alignItems="center" marginY="size-200">
                  <ProgressCircle size="S" aria-label="Loading notifications" isIndeterminate />
                  <Text>Loading notifications...</Text>
                </Flex>
              ) : error ? (
                <Text>Couldn&apos;t load notifications: {error}</Text>
              ) : notifications.length === 0 ? (
                <IllustratedMessage>
                  <Content>No notifications yet.</Content>
                </IllustratedMessage>
              ) : (
                <>
                  <Flex direction="row" justifyContent="end" marginBottom="size-100">
                    <ActionButton isQuiet isDisabled={unreadCount === 0} onPress={onMarkAllRead}>
                      Mark all as read
                    </ActionButton>
                  </Flex>
                  {/* Spectrum's View doesn't forward onClick (it's not in its
                      declared DOMProps, and gets filtered out) - a plain div
                      is what actually makes each row clickable. */}
                  <div style={{ maxHeight: "368px", overflow: "auto" }}>
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="notification-row"
                        style={{ backgroundColor: notification.read ? undefined : "#f5f5f5" }}
                        onClick={() => {
                          if (!notification.read) onMarkRead(notification.id);
                          if (isLowStock(notification)) {
                            onOpenProducts();
                          } else {
                            onOpenOrder(notification.incrementId);
                          }
                          close();
                        }}
                      >
                        <Flex direction="row" justifyContent="space-between">
                          <Text UNSAFE_style={{ fontWeight: notification.read ? "normal" : 600 }}>
                            {isLowStock(notification) ? lowStockTitle(notification) : `New Order #${notification.incrementId}`}
                          </Text>
                          <Text>{formatRelativeTime(notification.createdAt)}</Text>
                        </Flex>
                        <Text>
                          {isLowStock(notification)
                            ? lowStockSummary(notification)
                            : `${notification.customerName} - ${formatMoney(notification.grandTotal, notification.currencyCode)}`}
                        </Text>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Content>
          </Dialog>
        )}
      </DialogTrigger>
      {unreadCount > 0 && (
        <div style={{ position: "absolute", top: -4, right: -4, pointerEvents: "none" }}>
          <Badge variant="negative">{unreadCount > 99 ? "99+" : unreadCount}</Badge>
        </div>
      )}
    </div>
  );
}

NotificationBell.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      // "order" (or missing, for older entries) or "low_stock"
      type: PropTypes.string,
      incrementId: PropTypes.string,
      customerName: PropTypes.string,
      grandTotal: PropTypes.number,
      currencyCode: PropTypes.string,
      products: PropTypes.arrayOf(
        PropTypes.shape({ sku: PropTypes.string, name: PropTypes.string, qty: PropTypes.number })
      ),
      totalCount: PropTypes.number,
      createdAt: PropTypes.string,
      read: PropTypes.bool,
    })
  ).isRequired,
  unreadCount: PropTypes.number.isRequired,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  onOpenOrder: PropTypes.func.isRequired,
  onOpenProducts: PropTypes.func.isRequired,
  onMarkRead: PropTypes.func.isRequired,
  onMarkAllRead: PropTypes.func.isRequired,
};

export default NotificationBell;
