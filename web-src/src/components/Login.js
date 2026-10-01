import React, { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { Button, Flex, Form, Heading, ProgressCircle, StatusLight, TextField, View } from "@adobe/react-spectrum";
import allActions from "../config.json";
import actionWebInvoke from "../utils";
import kinexLogo from "url:../assets/kinex-logo.webp";

function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
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
        {},
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
      setError(/status: 401/.test(err.message) ? "Invalid username or password" : "Login failed. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <Flex direction="column" alignItems="center" justifyContent="center" height="100vh" gap="size-300">
      <img src={kinexLogo} alt="Kinex Media" style={{ height: "40px", width: "auto" }} />
      <View width="size-4600" padding="size-300" borderWidth="thin" borderColor="dark" borderRadius="medium">
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
  onLoginSuccess: PropTypes.func.isRequired,
};

export default Login;
