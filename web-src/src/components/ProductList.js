import React, { useCallback, useEffect, useState } from "react";
import {
  ActionButton,
  AlertDialog,
  Cell,
  Column,
  Content,
  DialogContainer,
  Flex,
  Heading,
  IllustratedMessage,
  ProgressCircle,
  Row,
  SearchField,
  StatusLight,
  TableBody,
  TableHeader,
  TableView,
  Text,
  View,
} from "@adobe/react-spectrum";
import PropTypes from "prop-types";
import Add from "@spectrum-icons/workflow/Add";
import Edit from "@spectrum-icons/workflow/Edit";
import Delete from "@spectrum-icons/workflow/Delete";

import allActions from "../config.json";
import actionWebInvoke from "../utils";
import ProductEditDialog from "./ProductEditDialog";
import ProductSearchResults from "./ProductSearchResults";

const actions = Object.keys(allActions).reduce((obj, key) => {
  if (key.lastIndexOf("/") > -1) {
    obj[key] = allActions[key];
  }
  return obj;
}, {});

const formatPrice = (price) => (typeof price === "number" ? `$${price.toFixed(2)}` : "-");

function ProductList({ ims }) {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingSku, setDeletingSku] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [categories, setCategories] = useState([]);

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!actions["product/list"]) {
        setProducts([]);
        return;
      }
      const result = await actionWebInvoke(actions["product/list"], authHeaders, {}, { method: "GET" });
      setProducts(result?.response?.products ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ims?.token]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!actions["product/categories"]) return;
    actionWebInvoke(actions["product/categories"], authHeaders, {}, { method: "GET" })
      .then((result) => setCategories(result?.response?.categories ?? []))
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ims?.token]);

  async function handleSave(product) {
    setIsSaving(true);
    try {
      await actionWebInvoke(actions["product/update"], authHeaders, { data: product }, { method: "POST" });
      setEditingProduct(null);
      await loadProducts();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(sku) {
    setIsSaving(true);
    try {
      await actionWebInvoke(actions["product/delete"], authHeaders, { sku }, { method: "POST" });
      setDeletingSku(null);
      await loadProducts();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSearchSubmit(value) {
    setActiveSearchQuery(value.trim());
  }

  function handleSearchClear() {
    setSearchInputValue("");
    setActiveSearchQuery("");
  }

  return (
    <View width="size-6000">
      <Flex direction="row" justifyContent="space-between" alignItems="center" marginBottom="size-200">
        <Heading level={1}>Products</Heading>
        <Flex direction="row" gap="size-150" alignItems="center">
          <SearchField
            aria-label="Search Commerce catalog by SKU or name"
            placeholder="Search Commerce by SKU or name"
            value={searchInputValue}
            onChange={setSearchInputValue}
            onSubmit={handleSearchSubmit}
            onClear={handleSearchClear}
            width="size-3400"
          />
          <ActionButton onPress={() => setEditingProduct({})}>
            <Add aria-label="Add product" />
            <Text>Add product</Text>
          </ActionButton>
        </Flex>
      </Flex>

      {error && (
        <View marginBottom="size-200">
          <StatusLight variant="negative">{error}</StatusLight>
        </View>
      )}

      {activeSearchQuery ? (
        <ProductSearchResults query={activeSearchQuery} ims={ims} onProductSynced={loadProducts} />
      ) : isLoading ? (
        <ProgressCircle aria-label="Loading products" isIndeterminate />
      ) : products.length === 0 ? (
        <IllustratedMessage>
          <Content>No products yet. Add one, or wait for a Commerce catalog event to sync one in.</Content>
        </IllustratedMessage>
      ) : (
        <TableView aria-label="Products" density="compact">
          <TableHeader>
            <Column key="sku">SKU</Column>
            <Column key="name">Name</Column>
            <Column key="price" align="end">
              Price
            </Column>
            <Column key="status">Status</Column>
            <Column key="actions" align="end">
              Actions
            </Column>
          </TableHeader>
          <TableBody items={products}>
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
                  <Flex direction="row" gap="size-100" justifyContent="end">
                    <ActionButton isQuiet onPress={() => setEditingProduct(product)} aria-label={`Edit ${product.sku}`}>
                      <Edit />
                    </ActionButton>
                    <ActionButton isQuiet onPress={() => setDeletingSku(product.sku)} aria-label={`Delete ${product.sku}`}>
                      <Delete />
                    </ActionButton>
                  </Flex>
                </Cell>
              </Row>
            )}
          </TableBody>
        </TableView>
      )}

      <DialogContainer onDismiss={() => setEditingProduct(null)}>
        {editingProduct && (
          <ProductEditDialog
            product={editingProduct}
            categories={categories}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={() => setEditingProduct(null)}
          />
        )}
      </DialogContainer>

      <DialogContainer onDismiss={() => setDeletingSku(null)}>
        {deletingSku && (
          <AlertDialog
            title="Delete product"
            variant="destructive"
            primaryActionLabel="Delete"
            cancelLabel="Cancel"
            isPrimaryActionDisabled={isSaving}
            onPrimaryAction={() => handleDelete(deletingSku)}
            onCancel={() => setDeletingSku(null)}
          >
            Are you sure you want to delete {deletingSku}? This permanently deletes the product in Commerce, not
            just this app&apos;s local copy. This cannot be undone.
          </AlertDialog>
        )}
      </DialogContainer>
    </View>
  );
}

ProductList.propTypes = {
  ims: PropTypes.shape({
    token: PropTypes.string,
    org: PropTypes.string,
    profile: PropTypes.object,
  }),
};

export default ProductList;
