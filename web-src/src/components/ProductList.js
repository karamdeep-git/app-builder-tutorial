import React, { useEffect, useState } from "react";
import {
  ActionButton,
  AlertDialog,
  Content,
  DialogContainer,
  Flex,
  Heading,
  IllustratedMessage,
  ProgressCircle,
  SearchField,
  StatusLight,
  Text,
  View,
} from "@adobe/react-spectrum";
import PropTypes from "prop-types";
import Add from "@spectrum-icons/workflow/Add";

import allActions from "../config.json";
import actionWebInvoke from "../utils";
import ProductEditDialog from "./ProductEditDialog";

const actions = Object.keys(allActions).reduce((obj, key) => {
  if (key.lastIndexOf("/") > -1) {
    obj[key] = allActions[key];
  }
  return obj;
}, {});

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

const formatPrice = (price) => (typeof price === "number" ? `$${price.toFixed(2)}` : "-");

// Magento stores updated_at as "YYYY-MM-DD HH:mm:ss" UTC with no zone marker,
// which some browsers refuse to parse as-is - reshaping it into ISO 8601
// makes `new Date(...)` reliable everywhere.
function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function getStockItem(product) {
  return product?.extension_attributes?.stock_item;
}

// Routed through our own product/image action rather than linking the
// browser straight at Magento's media URL - see actions-src/product/image
// for why a direct <img src> to that URL gets blocked in this dev setup.
function getThumbnailSrc(product) {
  if (!product?.thumbnailPath || !actions["product/image"]) {
    return null;
  }
  return `${actions["product/image"]}?path=${encodeURIComponent(product.thumbnailPath)}`;
}

// product/image requires an Adobe IMS token like every other action, and a
// plain <img src> can't send an Authorization header - so fetch the bytes
// with the same auth headers as every other call and hand the <img> a local
// object URL instead. Falls back to the placeholder if the fetch fails.
function AuthenticatedThumbnail({ src, authHeaders }) {
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl = null;
    setObjectUrl(null);
    fetch(src, { headers: authHeaders })
      .then((response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch((e) => {
        if (!cancelled) console.warn(`Thumbnail failed to load (${src}): ${e.message}`);
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // authHeaders is rebuilt every render; only a token change should refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, authHeaders.authorization]);

  return objectUrl ? (
    <img className="admin-grid-thumb" src={objectUrl} alt="" />
  ) : (
    <div className="admin-grid-thumb-placeholder" />
  );
}

AuthenticatedThumbnail.propTypes = {
  src: PropTypes.string.isRequired,
  authHeaders: PropTypes.object.isRequired,
};

function ProductList({ ims }) {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingSkus, setDeletingSkus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedSkus, setSelectedSkus] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [fetchingSku, setFetchingSku] = useState(null);
  // Bumped after a save/delete to force the effect below to refetch the
  // current page, without duplicating its fetch logic in a second function.
  const [reloadToken, setReloadToken] = useState(0);

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  useEffect(() => {
    setPage(1);
  }, [activeSearchQuery, pageSize]);

  useEffect(() => {
    setSelectedSkus(new Set());
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await actionWebInvoke(
          actions["product/search"],
          authHeaders,
          { query: activeSearchQuery, page, pageSize },
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
  }, [activeSearchQuery, page, pageSize, reloadToken, ims?.token]);

  useEffect(() => {
    if (!actions["product/categories"]) return;
    actionWebInvoke(actions["product/categories"], authHeaders, {}, { method: "GET" })
      .then((result) => setCategories(result?.response?.categories ?? []))
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ims?.token]);

  async function handleEditClick(product) {
    setError(null);
    setFetchingSku(product.sku);
    try {
      const result = await actionWebInvoke(actions["product/get"], authHeaders, { sku: product.sku }, { method: "GET" });
      setEditingProduct(result?.response?.product ?? product);
    } catch (e) {
      setError(e.message);
    } finally {
      setFetchingSku(null);
    }
  }

  async function handleSave(product) {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await actionWebInvoke(actions["product/update"], authHeaders, { data: product }, { method: "POST" });
      setMessage(`"${product.sku}" saved.`);
      setEditingProduct(null);
      setReloadToken((t) => t + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteConfirmed(skus) {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      for (const sku of skus) {
        // eslint-disable-next-line no-await-in-loop
        await actionWebInvoke(actions["product/delete"], authHeaders, { sku }, { method: "POST" });
      }
      setMessage(skus.length === 1 ? `"${skus[0]}" deleted.` : `${skus.length} products deleted.`);
      setDeletingSkus(null);
      setBulkAction("");
      // Deleting every item on a page beyond the first would otherwise leave
      // that page empty until the admin manually steps back - stepping back a
      // page already triggers the effect's refetch on its own.
      if (skus.length >= items.length && page > 1) {
        setPage((p) => p - 1);
      } else {
        setReloadToken((t) => t + 1);
      }
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

  function toggleRowSelected(sku) {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedSkus((prev) => (prev.size === items.length ? new Set() : new Set(items.map((p) => p.sku))));
  }

  function handleBulkActionChange(event) {
    const value = event.target.value;
    setBulkAction(value);
    if (value === "delete" && selectedSkus.size > 0) {
      setDeletingSkus([...selectedSkus]);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const allSelected = items.length > 0 && selectedSkus.size === items.length;

  return (
    <View width="100%" maxWidth="size-8000">
      <Flex direction="row" justifyContent="space-between" alignItems="center" marginBottom="size-200">
        <Heading level={1}>Products</Heading>
        <Flex direction="row" gap="size-150" alignItems="center" wrap="wrap">
          <SearchField
            aria-label="Search Commerce catalog by SKU or name"
            placeholder="Search Commerce by SKU or name"
            value={searchInputValue}
            onChange={setSearchInputValue}
            onSubmit={handleSearchSubmit}
            onClear={handleSearchClear}
            width="100%"
            maxWidth="size-3400"
          />
          <ActionButton onPress={() => setEditingProduct({})} isDisabled={isSaving}>
            <Add aria-label="Add product" />
            <Text>Add product</Text>
          </ActionButton>
        </Flex>
      </Flex>

      {message && (
        <View marginBottom="size-200">
          <StatusLight variant="positive">{message}</StatusLight>
        </View>
      )}
      {error && (
        <View marginBottom="size-200">
          <StatusLight variant="negative">{error}</StatusLight>
        </View>
      )}

      {isLoading && (
        <View marginBottom="size-200">
          <Flex direction="row" gap="size-100" alignItems="center">
            <ProgressCircle
              size="S"
              aria-label={activeSearchQuery ? "Searching products" : "Loading products"}
              isIndeterminate
            />
            <Text>{activeSearchQuery ? "Searching products..." : "Loading products..."}</Text>
          </Flex>
        </View>
      )}

      {!isLoading && items.length === 0 ? (
        <IllustratedMessage>
          <Content>
            {activeSearchQuery ? `No products matched "${activeSearchQuery}".` : "No products in the catalog yet."}
          </Content>
        </IllustratedMessage>
      ) : items.length > 0 ? (
        <>
          <div className="admin-grid-toolbar">
            <Flex direction="row" gap="size-150" alignItems="center">
              <select
                aria-label="Bulk actions"
                value={bulkAction}
                onChange={handleBulkActionChange}
                disabled={selectedSkus.size === 0 || isSaving}
              >
                <option value="">Actions{selectedSkus.size > 0 ? ` (${selectedSkus.size})` : ""}</option>
                <option value="delete">Delete</option>
              </select>
              {isSaving && deletingSkus?.length > 1 && (
                <Flex direction="row" gap="size-75" alignItems="center">
                  <ProgressCircle size="S" aria-label="Deleting selected products" isIndeterminate />
                  <Text>Deleting {deletingSkus.length} products...</Text>
                </Flex>
              )}
            </Flex>

            <Flex direction="row" gap="size-200" alignItems="center">
              <Text>{totalCount} records found</Text>
              <label>
                <Text marginEnd="size-75">Per page</Text>
                <select
                  aria-label="Records per page"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="admin-grid-arrow"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
              >
                ‹
              </button>
              <Text>
                Page {page} of {totalPages}
              </Text>
              <button
                type="button"
                className="admin-grid-arrow"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                ›
              </button>
            </Flex>
          </div>

          <div className="admin-grid-wrapper">
            <table className="admin-grid" aria-label="Products">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
                  </th>
                  <th>ID</th>
                  <th>Thumbnail</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Attribute Set</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Salable Quantity</th>
                  <th>Visibility</th>
                  <th>Status</th>
                  <th>Websites</th>
                  <th>Last Updated At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((product) => {
                  const stockItem = getStockItem(product);
                  const thumbnailSrc = getThumbnailSrc(product);
                  const isSelected = selectedSkus.has(product.sku);
                  return (
                    <tr key={product.sku} className={isSelected ? "is-selected" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelected(product.sku)}
                          aria-label={`Select ${product.sku}`}
                        />
                      </td>
                      <td>{product.id ?? "-"}</td>
                      <td>
                        {thumbnailSrc ? (
                          <AuthenticatedThumbnail src={thumbnailSrc} authHeaders={authHeaders} />
                        ) : (
                          <div className="admin-grid-thumb-placeholder" />
                        )}
                      </td>
                      <td>{product.name ?? "-"}</td>
                      <td>{product.typeLabel ?? "-"}</td>
                      <td>{product.attributeSetName ?? "-"}</td>
                      <td>{product.sku}</td>
                      <td>{formatPrice(product.price)}</td>
                      <td>{typeof stockItem?.qty === "number" ? stockItem.qty : "-"}</td>
                      {/* Magento's "Salable Quantity" differs from Quantity only under
                          multi-source inventory or pending reservations - resolving the
                          real value needs a separate per-product MSI call, which isn't
                          worth 20 extra Commerce calls per page here. */}
                      <td>{typeof stockItem?.qty === "number" ? stockItem.qty : "-"}</td>
                      <td>{product.visibilityLabel ?? "-"}</td>
                      <td>
                        <span className={`admin-grid-status is-${product.status === 2 ? "negative" : "positive"}`}>
                          {product.status === 2 ? "Disabled" : "Enabled"}
                        </span>
                      </td>
                      <td>{product.websiteNames?.length ? product.websiteNames.join(", ") : "-"}</td>
                      <td>{formatDate(product.updated_at)}</td>
                      <td>
                        <div className="admin-grid-row-actions">
                          <button
                            type="button"
                            onClick={() => handleEditClick(product)}
                            disabled={fetchingSku === product.sku || isSaving}
                          >
                            {fetchingSku === product.sku ? "Loading..." : "Edit"}
                          </button>
                          <button
                            type="button"
                            className="is-destructive"
                            onClick={() => setDeletingSkus([product.sku])}
                            disabled={fetchingSku === product.sku || isSaving}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

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

      <DialogContainer
        onDismiss={() => {
          setDeletingSkus(null);
          setBulkAction("");
        }}
      >
        {deletingSkus && (
          <AlertDialog
            title="Delete product"
            variant="destructive"
            primaryActionLabel={isSaving ? "Deleting..." : "Delete"}
            cancelLabel="Cancel"
            isPrimaryActionDisabled={isSaving}
            onPrimaryAction={() => handleDeleteConfirmed(deletingSkus)}
            onCancel={() => {
              setDeletingSkus(null);
              setBulkAction("");
            }}
          >
            {deletingSkus.length === 1
              ? `Are you sure you want to delete ${deletingSkus[0]}? This permanently deletes the product in Commerce. This cannot be undone.`
              : `Are you sure you want to delete these ${deletingSkus.length} products? This permanently deletes them in Commerce. This cannot be undone.`}
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
