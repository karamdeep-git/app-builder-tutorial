import React, { useState } from "react";
import { Button, Provider, Text, defaultTheme, Grid, View } from "@adobe/react-spectrum";
import ErrorBoundary from "react-error-boundary";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import SideBar from "./SideBar";
import ActionsForm from "./ActionsForm";
import ProductList from "./ProductList";
import Login from "./Login";
import Dashboard from "./Dashboard";
import Indexing from "./Indexing";
import CommandManager from "./CommandManager";
import { Home } from "./Home";
import { About } from "./About";
import kinexLogo from "url:../assets/kinex-logo.webp";

const ADMIN_USER_STORAGE_KEY = "adminUser";

function readStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_USER_STORAGE_KEY));
  } catch (e) {
    return null;
  }
}

function App(props) {
  const [currentUser, setCurrentUser] = useState(readStoredUser);

  // use exc runtime event handlers
  // respond to configuration change events (e.g. user switches org)
  props.runtime.on("configuration", ({ imsOrg, imsToken, locale }) => {
    console.log("configuration change", { imsOrg, imsToken, locale });
  });
  // respond to history change events
  props.runtime.on("history", ({ type, path }) => {
    console.log("history change", { type, path });
  });

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
          {!currentUser ? (
            <Login onLoginSuccess={handleLoginSuccess} />
          ) : (
            <Grid areas={["sidebar content"]} columns={["256px", "3fr"]} rows={["auto"]} height="100vh" gap="size-100">
              <View gridArea="sidebar" backgroundColor="gray-200">
                <View UNSAFE_style={{ backgroundColor: "#000" }} padding="size-200">
                  <img
                    src={kinexLogo}
                    alt="Kinex Media"
                    style={{ height: "28px", width: "auto", display: "block" }}
                  />
                </View>
                <View padding="size-200">
                  <SideBar></SideBar>
                </View>
                <View padding="size-200">
                  <Text>Signed in as {currentUser.username}</Text>
                  <View marginTop="size-100">
                    <Button variant="secondary" onPress={handleLogout}>
                      Log out
                    </Button>
                  </View>
                </View>
              </View>
              <View gridArea="content" padding="size-200">
                <Routes>
                  <Route path="/" element={<ProductList ims={props.ims} />} />
                  <Route path="/dashboard" element={<Dashboard username={currentUser.username} ims={props.ims} />} />
                  <Route path="/indexing" element={<Indexing ims={props.ims} />} />
                  <Route
                    path="/commands"
                    element={<CommandManager ims={props.ims} currentUser={currentUser.username} />}
                  />
                  <Route path="/home" element={<Home />} />
                  <Route path="/actions" element={<ActionsForm runtime={props.runtime} ims={props.ims} />} />
                  <Route path="/about" element={<About />} />
                </Routes>
              </View>
            </Grid>
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
