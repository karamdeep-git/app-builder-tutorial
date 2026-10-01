import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Flex, Heading, ProgressCircle, StatusLight, Text, View } from "@adobe/react-spectrum";
import allActions from "../config.json";
import actionWebInvoke from "../utils";

function Dashboard({ username, ims }) {
  const [productCount, setProductCount] = useState(null);
  const [error, setError] = useState(null);

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  useEffect(() => {
    if (!allActions["product/list"]) return;
    let cancelled = false;
    actionWebInvoke(allActions["product/list"], authHeaders, {}, { method: "GET" })
      .then((result) => {
        if (!cancelled) setProductCount(result?.response?.products?.length ?? 0);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ims?.token]);

  return (
    <View width="size-6000">
      <Heading level={1}>Dashboard</Heading>
      <Text>Welcome back, {username}.</Text>

      {error && (
        <View marginTop="size-200">
          <StatusLight variant="negative">{error}</StatusLight>
        </View>
      )}

      <Flex direction="row" gap="size-300" marginTop="size-300">
        <View borderWidth="thin" borderColor="dark" borderRadius="medium" padding="size-300" width="size-2400">
          <Heading level={3} marginTop="size-0">
            Cached products
          </Heading>
          {productCount === null ? (
            <ProgressCircle size="S" isIndeterminate aria-label="Loading product count" />
          ) : (
            <Text>{productCount}</Text>
          )}
        </View>
      </Flex>

      <View marginTop="size-300">
        <Link to="/">Go to Products</Link>
      </View>
    </View>
  );
}

Dashboard.propTypes = {
  username: PropTypes.string,
  ims: PropTypes.object,
};

export default Dashboard;
