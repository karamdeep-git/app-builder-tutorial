import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { ActionButton, Heading, StatusLight, Text } from "@adobe/react-spectrum";
import Box from "@spectrum-icons/workflow/Box";
import ChevronRight from "@spectrum-icons/workflow/ChevronRight";
import Refresh from "@spectrum-icons/workflow/Refresh";
import ShoppingCart from "@spectrum-icons/workflow/ShoppingCart";
import UserAdmin from "@spectrum-icons/workflow/UserAdmin";
import UserGroup from "@spectrum-icons/workflow/UserGroup";
import allActions from "../config.json";
import actionWebInvoke, { describeError } from "../utils";

// Below this a count reads fine in full (2,044); above it, compact (12.9K)
// with the exact figure in the tooltip.
const COMPACT_FROM = 100000;

function formatCount(value) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat(undefined, value >= COMPACT_FROM ? { notation: "compact", maximumFractionDigits: 1 } : {}).format(
    value
  );
}

function formatMoney(value, currency) {
  if (typeof value !== "number") return "—";
  const compact = value >= 1000000 ? { notation: "compact", maximumFractionDigits: 2 } : {};
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", ...compact }).format(value);
  } catch (e) {
    return `${value.toFixed(2)} ${currency ?? ""}`.trim();
  }
}

function Skeleton({ width }) {
  return <span className="dashboard-skeleton" style={{ width }} aria-hidden="true" />;
}

Skeleton.propTypes = { width: PropTypes.string };

// One headline number, linking to the page it summarizes.
function StatTile({ to, icon, label, value, exact, sub, isLoading, error }) {
  return (
    <Link to={to} className="dashboard-tile" aria-label={`${label}: ${exact ?? value}. Open ${label.toLowerCase()}`}>
      <div className="dashboard-tile-head">
        <span className="dashboard-label">{label}</span>
        <span className="dashboard-tile-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      {isLoading ? (
        <>
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </>
      ) : error ? (
        <>
          <div className="dashboard-tile-value">—</div>
          <div className="dashboard-error">Couldn&apos;t load: {error}</div>
        </>
      ) : (
        <>
          <div className="dashboard-tile-value" title={exact}>
            {value}
          </div>
          <div className="dashboard-tile-sub">{sub}</div>
        </>
      )}
    </Link>
  );
}

StatTile.propTypes = {
  to: PropTypes.string.isRequired,
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
  exact: PropTypes.string,
  sub: PropTypes.node,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
};

function Dashboard({ username, ims }) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await actionWebInvoke(allActions["dashboard/stats"], authHeaders, {}, { method: "GET" });
      setStats(result?.response ?? null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ims?.token]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const errors = stats?.errors ?? {};
  // Skeletons only on the first load - a refresh keeps the current numbers on screen.
  const showSkeleton = isLoading && !stats;
  const today = stats?.today;
  const updatedAt = stats?.generatedAt
    ? new Date(stats.generatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <Heading level={1} marginBottom="size-50">
            Dashboard
          </Heading>
          <Text UNSAFE_className="dashboard-muted">Welcome back, {username}.</Text>
        </div>
        <div className="dashboard-header-actions">
          {updatedAt && <span className="dashboard-muted">Updated {updatedAt}</span>}
          <ActionButton onPress={loadStats} isDisabled={isLoading} aria-label="Refresh dashboard">
            <Refresh />
            <Text>{isLoading && stats ? "Refreshing..." : "Refresh"}</Text>
          </ActionButton>
        </div>
      </div>

      {error && (
        <div className="dashboard-banner">
          <StatusLight variant="negative">Couldn&apos;t load the dashboard: {error}</StatusLight>
        </div>
      )}

      <section className="dashboard-hero" aria-labelledby="dashboard-hero-label">
        <div>
          <h2 id="dashboard-hero-label" className="dashboard-label">
            Today&apos;s sales
          </h2>
          {showSkeleton ? (
            <>
              <Skeleton width="220px" />
              <Skeleton width="160px" />
            </>
          ) : errors.today || !today ? (
            <>
              <div className="dashboard-hero-value">—</div>
              <div className="dashboard-error">Couldn&apos;t load: {errors.today ?? error ?? "No data"}</div>
            </>
          ) : (
            <>
              <div className="dashboard-hero-value">{formatMoney(today.sales, stats.currency)}</div>
              <div className="dashboard-hero-orders">
                <strong>{formatCount(today.orders)}</strong> {today.orders === 1 ? "order" : "orders"} today
                {today.partial && " (sales cover the first 3,000)"}
              </div>
              <div className="dashboard-note">
                Excludes canceled orders · &quot;Today&quot; in store time ({stats.timezone})
              </div>
            </>
          )}
        </div>
        <Link to="/orders" className="dashboard-hero-link">
          View orders <ChevronRight size="S" aria-hidden="true" />
        </Link>
      </section>

      <div className="dashboard-tiles">
        <StatTile
          to="/orders"
          icon={<ShoppingCart size="S" />}
          label="Total orders"
          value={formatCount(stats?.orders?.total)}
          exact={stats?.orders ? stats.orders.total.toLocaleString() : undefined}
          sub="All time"
          isLoading={showSkeleton}
          error={errors.orders ?? (!stats && !isLoading ? error : undefined)}
        />
        <StatTile
          to="/customers"
          icon={<UserGroup size="S" />}
          label="Customers"
          value={formatCount(stats?.customers?.total)}
          exact={stats?.customers ? stats.customers.total.toLocaleString() : undefined}
          sub="Registered accounts"
          isLoading={showSkeleton}
          error={errors.customers ?? (!stats && !isLoading ? error : undefined)}
        />
        <StatTile
          to="/"
          icon={<Box size="S" />}
          label="Enabled products"
          value={formatCount(stats?.products?.enabled)}
          exact={stats?.products ? stats.products.enabled.toLocaleString() : undefined}
          sub="Status: Enabled"
          isLoading={showSkeleton}
          error={errors.products ?? (!stats && !isLoading ? error : undefined)}
        />
        <StatTile
          to="/admin-users"
          icon={<UserAdmin size="S" />}
          label="Active admins"
          value={formatCount(stats?.admins?.active)}
          exact={stats?.admins ? `${stats.admins.active} of ${stats.admins.total}` : undefined}
          sub={stats?.admins ? `of ${stats.admins.total} admin ${stats.admins.total === 1 ? "user" : "users"}` : ""}
          isLoading={showSkeleton}
          error={errors.admins ?? (!stats && !isLoading ? error : undefined)}
        />
      </div>
    </div>
  );
}

Dashboard.propTypes = {
  username: PropTypes.string,
  ims: PropTypes.object,
};

export default Dashboard;
