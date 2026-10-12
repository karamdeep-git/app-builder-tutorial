import React, { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { Button, Flex, Form, Heading, ProgressCircle, StatusLight, TextField, View } from "@adobe/react-spectrum";
import allActions from "../config.json";
import actionWebInvoke from "../utils";
import kinexLogo from "url:../assets/kinex-logo.webp";

function Login({ ims, onLoginSuccess }) {
  const navigate = useNavigate();

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await actionWebInvoke(
        allActions["auth/login"],
        authHeaders,
        { data: { username, password } },
        { method: "POST" }
      );
      // Navigate before flipping the parent's logged-in state, so that when the
      // authenticated <Routes> render for the first time, the location is
      // already "/dashboard" - otherwise it briefly matches "/" and mounts
      // ProductList first (this app renders via legacy ReactDOM.render, so
      // these two state updates aren't auto-batched into a single render).
      navigate("/dashboard");
      onLoginSuccess(result?.response?.username ?? username);
    } catch (err) {
      // A 401 can come from two layers: auth/login itself (wrong Magento
      // credentials - its body says so) or the Adobe IMS validator in front of
      // every action (missing/expired/wrong-org token), which is never the
      // user's password's fault.
      if (/Invalid username or password/.test(err.message)) {
        setError("Invalid username or password");
      } else if (/status: (401|403)/.test(err.message)) {
        setError("Your Adobe session couldn't be verified. Reload the app from Experience Cloud and try again.");
      } else {
        setError("Login failed. Please try again.");
      }
      setIsSubmitting(false);
    }
  }

  return (
    <Flex direction="column" alignItems="center" justifyContent="center" height="100vh" gap="size-300">
      <img src={kinexLogo} alt="Kinex Media" style={{ height: "40px", width: "auto" }} />
      <View
        width="100%"
        maxWidth="size-4600"
        marginX="size-200"
        padding="size-300"
        borderWidth="thin"
        borderColor="dark"
        borderRadius="medium"
      >
        <Heading level={2}>Admin Login</Heading>
        <Form onSubmit={handleSubmit}>
          <TextField label="Username" value={username} onChange={setUsername} isRequired autoFocus />
          <TextField label="Password" type="password" value={password} onChange={setPassword} isRequired />
          {error && (
            <View marginTop="size-100">
              <StatusLight variant="negative">{error}</StatusLight>
            </View>
          )}
          <Button type="submit" variant="cta" isDisabled={isSubmitting} marginTop="size-200">
            {isSubmitting ? <ProgressCircle size="S" isIndeterminate aria-label="Logging in" /> : "Log in"}
          </Button>
        </Form>
      </View>
    </Flex>
  );
}

Login.propTypes = {
  ims: PropTypes.any,
  onLoginSuccess: PropTypes.func.isRequired,
};

export default Login;
