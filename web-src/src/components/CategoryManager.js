import React, { useCallback, useEffect, useState } from "react";
import {
  ActionButton,
  AlertDialog,
  Button,
  ButtonGroup,
  Cell,
  Checkbox,
  Column,
  Content,
  Dialog,
  DialogContainer,
  Divider,
  Flex,
  Heading,
  Item,
  Picker,
  ProgressCircle,
  Row,
  StatusLight,
  TableBody,
  TableHeader,
  TableView,
  Text,
  TextField,
  View,
} from "@adobe/react-spectrum";
import Add from "@spectrum-icons/workflow/Add";
import Edit from "@spectrum-icons/workflow/Edit";
import Delete from "@spectrum-icons/workflow/Delete";
import AddCircle from "@spectrum-icons/workflow/AddCircle";

import allActions from "../config.json";
import actionWebInvoke from "../utils";

function indent(name, level) {
  return "    ".repeat(level) + name;
}

function CategoryDialog({ category, categories, onSave, onCancel, isSaving }) {
  const isNew = !category?.id;
  const [name, setName] = useState(category?.name ?? "");
  const [parentId, setParentId] = useState(category?.parentId ?? categories[0]?.id);
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [isAnchor, setIsAnchor] = useState(category?.isAnchor ?? true);

  function handleSave() {
    onSave({ id: category?.id, name, parentId, isActive, isAnchor });
  }

  return (
    <Dialog>
      <Heading>{isNew ? "Add Category" : `Edit ${category.name}`}</Heading>
      <Divider />
      <Content>
        <TextField label="Name" value={name} onChange={setName} isRequired autoFocus />
        {isNew && (
          <Picker
            label="Parent Category"
            items={categories}
            selectedKey={String(parentId)}
            onSelectionChange={(key) => setParentId(Number(key))}
          >
            {(item) => <Item key={String(item.id)}>{indent(item.name, item.level)}</Item>}
          </Picker>
        )}
        <Checkbox isSelected={isActive} onChange={setIsActive} marginTop="size-200">
          Active
        </Checkbox>
        <Checkbox isSelected={isAnchor} onChange={setIsAnchor} marginTop="size-100">
          Anchor (show products from subcategories)
        </Checkbox>
      </Content>
      <ButtonGroup>
        <Button variant="secondary" onPress={onCancel} isDisabled={isSaving}>
          Cancel
        </Button>
        <Button variant="accent" onPress={handleSave} isDisabled={!name.trim() || isSaving}>
          Save
        </Button>
      </ButtonGroup>
    </Dialog>
  );
}

function CategoryManager({ ims }) {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await actionWebInvoke(allActions["category/list"], authHeaders, {}, { method: "GET" });
      setCategories(result?.response?.categories ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ims?.token]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  async function handleSave({ id, name, parentId, isActive, isAnchor }) {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (id) {
        await actionWebInvoke(
          allActions["category/update"],
          authHeaders,
          { categoryId: id, name, isActive, isAnchor },
          { method: "POST" }
        );
        setMessage(`"${name}" updated.`);
      } else {
        await actionWebInvoke(
          allActions["category/create"],
          authHeaders,
          { name, parentId, isActive, isAnchor },
          { method: "POST" }
        );
        setMessage(`"${name}" created.`);
      }
      setEditingCategory(null);
      await loadCategories();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditClick(category) {
    setError(null);
    try {
      const result = await actionWebInvoke(
        allActions["category/get"],
        authHeaders,
        { categoryId: category.id },
        { method: "GET" }
      );
      setEditingCategory(result?.response?.category ?? category);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(category) {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await actionWebInvoke(
        allActions["category/delete"],
        authHeaders,
        { categoryId: category.id },
        { method: "POST" }
      );
      setMessage(`"${category.name}" deleted.`);
      setDeletingCategory(null);
      await loadCategories();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View width="size-7000">
      <Flex direction="row" justifyContent="space-between" alignItems="center" marginBottom="size-200">
        <Heading level={1}>Categories</Heading>
        <ActionButton onPress={() => setEditingCategory({ parentId: categories[0]?.id })}>
          <Add aria-label="Add category" />
          <Text>Add Category</Text>
        </ActionButton>
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

      {isLoading && categories.length === 0 ? (
        <ProgressCircle aria-label="Loading categories" isIndeterminate />
      ) : (
        <TableView aria-label="Categories" density="compact">
          <TableHeader>
            <Column key="name" minWidth={260}>
              Name
            </Column>
            <Column key="status" minWidth={110}>
              Status
            </Column>
            <Column key="actions" align="end" minWidth={180}>
              Actions
            </Column>
          </TableHeader>
          <TableBody items={categories}>
            {(category) => (
              <Row key={category.id}>
                <Cell>{indent(category.name, category.level)}</Cell>
                <Cell>
                  <StatusLight variant={category.isActive ? "positive" : "neutral"}>
                    {category.isActive ? "Active" : "Inactive"}
                  </StatusLight>
                </Cell>
                <Cell>
                  <Flex direction="row" justifyContent="end" gap="size-50">
                    <ActionButton
                      isQuiet
                      onPress={() => setEditingCategory({ parentId: category.id })}
                      aria-label={`Add subcategory under ${category.name}`}
                    >
                      <AddCircle />
                    </ActionButton>
                    <ActionButton
                      isQuiet
                      onPress={() => handleEditClick(category)}
                      aria-label={`Edit ${category.name}`}
                    >
                      <Edit />
                    </ActionButton>
                    {category.level > 0 && (
                      <ActionButton
                        isQuiet
                        onPress={() => setDeletingCategory(category)}
                        aria-label={`Delete ${category.name}`}
                      >
                        <Delete />
                      </ActionButton>
                    )}
                  </Flex>
                </Cell>
              </Row>
            )}
          </TableBody>
        </TableView>
      )}

      <DialogContainer onDismiss={() => setEditingCategory(null)}>
        {editingCategory && (
          <CategoryDialog
            category={editingCategory}
            categories={categories}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={() => setEditingCategory(null)}
          />
        )}
      </DialogContainer>

      <DialogContainer onDismiss={() => setDeletingCategory(null)}>
        {deletingCategory && (
          <AlertDialog
            title="Delete category"
            variant="destructive"
            primaryActionLabel="Delete"
            cancelLabel="Cancel"
            isPrimaryActionDisabled={isSaving}
            onPrimaryAction={() => handleDelete(deletingCategory)}
            onCancel={() => setDeletingCategory(null)}
          >
            Are you sure you want to delete &quot;{deletingCategory.name}&quot;? Magento will also delete all of
            its subcategories, and unassign any products from them. This cannot be undone.
          </AlertDialog>
        )}
      </DialogContainer>
    </View>
  );
}

export default CategoryManager;
