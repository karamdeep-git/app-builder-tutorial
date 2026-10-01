import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  ActionButton,
  Cell,
  Column,
  Content,
  Flex,
  IllustratedMessage,
  ProgressCircle,
  Row,
  StatusLight,
  TableBody,
  TableHeader,
  TableView,
  Text,
  View,
} from "@adobe/react-spectrum";

import allActions from "../config.json";
import actionWebInvoke from "../utils";

const actions = Object.keys(allActions).reduce((obj, key) => {
  if (key.lastIndexOf("/") > -1) {
    obj[key] = allActions[key];
  }
  return obj;
}, {});

const PAGE_SIZE = 20;

const formatPrice = (price) => (typeof price === "number" ? `$${price.toFixed(2)}` : "-");

function ProductSearchResults({ query, ims, onProductSynced }) {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncingSku, setSyncingSku] = useState(null);
  const [syncedSkus, setSyncedSkus] = useState(() => new Set());

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await actionWebInvoke(
          actions["product/search"],
          authHeaders,
          { query, page, pageSize: PAGE_SIZE },
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
  }, [query, page, ims?.token]);

  async function handleAddToList(product) {
    // eslint-disable-next-line no-unused-vars
    const { _isSyncing, _isSynced, ...cleanProduct } = product;
    setSyncingSku(cleanProduct.sku);
    try {
      await actionWebInvoke(actions["product/update"], authHeaders, { data: cleanProduct }, { method: "POST" });
      setSyncedSkus((prev) => new Set(prev).add(cleanProduct.sku));
      onProductSynced?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncingSku(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // TableBody's collection diffs on item identity, not on state referenced by
  // closure inside the render callback - embed the current sync status
  // directly in the item objects so a syncedSkus/syncingSku change always
  // produces new item references the table will actually re-render.
  const rowItems = items.map((product) => ({
    ...product,
    _isSyncing: syncingSku === product.sku,
    _isSynced: syncedSkus.has(product.sku),
  }));

  return (
    <View>
      <View marginBottom="size-200">
        <StatusLight variant="info">
          Live results from Commerce. &quot;Add to my list&quot; saves a local cached copy for this app, so it shows
          up in the Products list below without needing another Commerce event.
        </StatusLight>
      </View>

      {error && (
        <View marginBottom="size-200">
          <StatusLight variant="negative">{error}</StatusLight>
        </View>
      )}

      {isLoading ? (
        <ProgressCircle aria-label="Searching Commerce" isIndeterminate />
      ) : items.length === 0 ? (
        <IllustratedMessage>
          <Content>No Commerce products matched &quot;{query}&quot;.</Content>
        </IllustratedMessage>
      ) : (
        <>
          <TableView aria-label="Search results" density="compact">
            <TableHeader>
              <Column key="sku">SKU</Column>
              <Column key="name">Name</Column>
              <Column key="price" align="end">
                Price
              </Column>
              <Column key="status">Status</Column>
              <Column key="actions" align="end" width={180}>
                Actions
              </Column>
            </TableHeader>
            <TableBody items={rowItems}>
              {(product) => (
                <Row key={product.sku}>
                  <Cell>{product.sku}</Cell>
                  <Cell>{product.name ?? "-"}</Cell>
                  <Cell>{formatPrice(product.price)}</Cell>
                  <Cell>
                    <StatusLight variant={product.status === 2 ? "negative" : "positive"}>
                      {product.status === 2 ? "Disabled" : "Enabled"}
                    </StatusLight>
                  </Cell>
                  <Cell>
                    <ActionButton
                      isQuiet
                      isDisabled={product._isSyncing || product._isSynced}
                      onPress={() => handleAddToList(product)}
                    >
                      <Text>{product._isSynced ? "Added" : "Add to my list"}</Text>
                    </ActionButton>
                  </Cell>
                </Row>
              )}
            </TableBody>
          </TableView>

          <Flex direction="row" gap="size-150" alignItems="center" marginTop="size-200">
            <ActionButton isDisabled={page <= 1} onPress={() => setPage((p) => p - 1)}>
              <Text>Previous</Text>
            </ActionButton>
            <ActionButton isDisabled={page >= totalPages} onPress={() => setPage((p) => p + 1)}>
              <Text>Next</Text>
            </ActionButton>
            <Text>
              Page {page} of {totalPages} ({totalCount} results)
            </Text>
          </Flex>
        </>
      )}
    </View>
  );
}

ProductSearchResults.propTypes = {
  query: PropTypes.string.isRequired,
  ims: PropTypes.shape({
    token: PropTypes.string,
    org: PropTypes.string,
  }),
  onProductSynced: PropTypes.func,
};

export default ProductSearchResults;
