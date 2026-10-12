import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Provider,
  Text,
  defaultTheme,
  Grid,
  View,
  Flex,
  Heading,
  Link,
  ToastContainer,
  ToastQueue,
} from "@adobe/react-spectrum";
import ErrorBoundary from "react-error-boundary";
import { HashRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import SideBar from "./SideBar";
import ActionsForm from "./ActionsForm";
import ProductList from "./ProductList";
import OrderList from "./OrderList";
import Login from "./Login";
import Dashboard from "./Dashboard";
import Indexing from "./Indexing";
import CommandManager from "./CommandManager";
import CategoryManager from "./CategoryManager";
import AdminUserManager from "./AdminUserManager";
import NotificationBell from "./NotificationBell";
import { Home } from "./Home";
import { About } from "./About";
import kinexLogo from "url:../assets/kinex-logo.webp";
import allActions from "../config.json";
import actionWebInvoke from "../utils";
import { playNotificationSound } from "../notificationSound";

const ADMIN_USER_STORAGE_KEY = "adminUser";
const NOTIFICATIONS_POLL_MS = 15000;
// Same launch URL `aio app deploy` prints for viewing an app in the shell.
const EXC_SHELL_LAUNCH_PREFIX = "https://experience.adobe.com/?devMode=true#/custom-apps/?localDevUrl=";

function readStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_USER_STORAGE_KEY));
  } catch (e) {
    return null;
  }
}

function formatMoney(amount, currencyCode) {
  if (typeof amount !== "number") return "-";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode || "USD" }).format(amount);
  } catch (e) {
    return `${amount.toFixed(2)} ${currencyCode ?? ""}`.trim();
  }
}

// Every backend action requires an Adobe IMS token (require-adobe-auth: true),
// and only the Experience Cloud Shell hands one to the app. Opened directly
// (e.g. the bare adobeio-static.net URL) every call would just 401, so say so
// up front instead of showing a login form that can never succeed.
function ShellRequired() {
  const shellUrl = `${EXC_SHELL_LAUNCH_PREFIX}${window.location.origin}${window.location.pathname}`;
  return (
    <Flex direction="column" alignItems="center" justifyContent="center" height="100vh" gap="size-200">
      <img src={kinexLogo} alt="Kinex Media" style={{ height: "40px", width: "auto" }} />
      <Heading level={2}>Open this app in Adobe Experience Cloud</Heading>
      <Text>This app needs your Adobe sign-in, which is only available when it runs inside Experience Cloud.</Text>
      <Link>
        <a href={shellUrl}>Open in Experience Cloud</a>
      </Link>
    </Flex>
  );
}

// Owns order-notification polling so it keeps running across every page, not
// just the Orders page - needs to live inside <Router> (for useNavigate) and
// is otherwise a plain child of App, not a route itself.
function AuthenticatedApp({ ims, runtime, currentUser, onLogout }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [notificationsError, setNotificationsError] = useState(null);
  const seenIdsRef = useRef(null);

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  const fetchNotifications = useCallback(
    async (isFirstLoad) => {
      try {
        const result = await actionWebInvoke(allActions["notifications/list"], authHeaders, {}, { method: "GET" });
        const list = result?.response?.notifications ?? [];

        // Toast only genuinely new arrivals, never on the very first load (that
        // would re-toast the admin's entire history every time they open the app).
        if (!isFirstLoad && seenIdsRef.current) {
          const newArrivals = list.filter((n) => !seenIdsRef.current.has(n.id));
          if (newArrivals.length > 0) {
            // One chime per poll, not one per order - several orders landing
            // in the same 15s window shouldn't overlap into a jarring noise.
            playNotificationSound();
          }
          newArrivals.forEach((n) => {
            ToastQueue.info(`New Order Received! #${n.incrementId} - ${n.customerName} - ${formatMoney(n.grandTotal, n.currencyCode)}`, {
              actionLabel: "View",
              onAction: () => navigate(`/orders?openOrderIncrementId=${n.incrementId}`),
              timeout: 8000,
            });
          });
        }
        seenIdsRef.current = new Set(list.map((n) => n.id));

        setNotifications(list);
        setUnreadCount(result?.response?.unreadCount ?? 0);
        setNotificationsError(null);
      } catch (e) {
        setNotificationsError(e.message);
      } finally {
        setIsLoadingNotifications(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [ims?.token]
  );

  useEffect(() => {
    fetchNotifications(true);
    const interval = setInterval(() => fetchNotifications(false), NOTIFICATIONS_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function handleMarkRead(id) {
    try {
      const result = await actionWebInvoke(allActions["notifications/mark-read"], authHeaders, { id }, { method: "POST" });
      setNotifications(result?.response?.notifications ?? []);
      setUnreadCount(result?.response?.unreadCount ?? 0);
    } catch (e) {
      setNotificationsError(e.message);
    }
  }

  async function handleMarkAllRead() {
    try {
      const result = await actionWebInvoke(allActions["notifications/mark-read"], authHeaders, { all: true }, { method: "POST" });
      setNotifications(result?.response?.notifications ?? []);
      setUnreadCount(result?.response?.unreadCount ?? 0);
    } catch (e) {
      setNotificationsError(e.message);
    }
  }

  function handleOpenOrder(incrementId) {
    navigate(`/orders?openOrderIncrementId=${incrementId}`);
  }

  return (
    <Grid
      UNSAFE_className="app-shell"
      areas={["sidebar content"]}
      columns={["256px", "3fr"]}
      rows={["auto"]}
      height="100vh"
      gap="size-100"
    >
      <View gridArea="sidebar" backgroundColor="gray-200" UNSAFE_className="app-shell-sidebar" overflow="auto">
        <View UNSAFE_style={{ backgroundColor: "#000" }} padding="size-200">
          <img src={kinexLogo} alt="Kinex Media" style={{ height: "28px", width: "auto", display: "block" }} />
        </View>
        <View paddingX="size-200" paddingTop="size-150" paddingBottom="size-100" borderBottomWidth="thin" borderBottomColor="dark">
          <Flex direction="row" justifyContent="space-between" alignItems="center">
            <Text UNSAFE_style={{ fontSize: "12px", fontWeight: 600, color: "#6e6e6e", textTransform: "uppercase" }}>
              Notifications
            </Text>
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              isLoading={isLoadingNotifications}
              error={notificationsError}
              onOpenOrder={handleOpenOrder}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
            />
          </Flex>
        </View>
        <View padding="size-200">
          <SideBar></SideBar>
        </View>
        <View padding="size-200">
          <Text>Signed in as {currentUser.username}</Text>
          <View marginTop="size-100">
            <Button variant="secondary" onPress={onLogout}>
              Log out
            </Button>
          </View>
        </View>
      </View>
      <View gridArea="content" padding="size-200" overflow="auto">
        <Routes>
          <Route path="/" element={<ProductList ims={ims} />} />
          <Route path="/orders" element={<OrderList ims={ims} />} />
          <Route path="/dashboard" element={<Dashboard username={currentUser.username} ims={ims} />} />
          <Route path="/indexing" element={<Indexing ims={ims} />} />
          <Route path="/categories" element={<CategoryManager ims={ims} />} />
          <Route path="/admin-users" element={<AdminUserManager ims={ims} currentUsername={currentUser.username} />} />
          <Route path="/commands" element={<CommandManager ims={ims} currentUser={currentUser.username} />} />
          <Route path="/home" element={<Home />} />
          <Route path="/actions" element={<ActionsForm runtime={runtime} ims={ims} />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </View>
    </Grid>
  );
}

function App(props) {
  const [currentUser, setCurrentUser] = useState(readStoredUser);
  const [ims, setIms] = useState(props.ims);

  // use exc runtime event handlers - registered once, not on every render
  useEffect(() => {
    // respond to configuration change events (e.g. user switches org, or the
    // shell refreshes the IMS token). Every action validates that token, so
    // holding on to the one from startup would start failing every call once
    // it expires.
    props.runtime.on("configuration", ({ imsOrg, imsToken, locale }) => {
      console.log("configuration change", { imsOrg, locale });
      setIms((prev) => ({
        ...prev,
        ...(imsOrg ? { org: imsOrg } : {}),
        ...(imsToken ? { token: imsToken } : {}),
      }));
    });
    // respond to history change events
    props.runtime.on("history", ({ type, path }) => {
      console.log("history change", { type, path });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLoginSuccess(username) {
    const user = { username };
    sessionStorage.setItem(ADMIN_USER_STORAGE_KEY, JSON.stringify(user));
    setCurrentUser(user);
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_USER_STORAGE_KEY);
    setCurrentUser(null);
  }

  return (
    <ErrorBoundary onError={onError} FallbackComponent={fallbackComponent}>
      <Router>
        <Provider theme={defaultTheme} colorScheme={"light"}>
          <ToastContainer />
          {!ims?.token ? (
            <ShellRequired />
          ) : !currentUser ? (
            <Login ims={ims} onLoginSuccess={handleLoginSuccess} />
          ) : (
            <AuthenticatedApp ims={ims} runtime={props.runtime} currentUser={currentUser} onLogout={handleLogout} />
          )}
        </Provider>
      </Router>
    </ErrorBoundary>
  );

  // Methods

  // error handler on UI rendering failure
  function onError(e, componentStack) {}

  // component to show if UI fails rendering
  function fallbackComponent({ componentStack, error }) {
    return (
      <React.Fragment>
        <h1 style={{ textAlign: "center", marginTop: "20px" }}>Something went wrong :(</h1>
        <pre>{componentStack + "\n" + error.message}</pre>
      </React.Fragment>
    );
  }
}

export default App;
