import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  Heading,
  Divider,
  Content,
  Form,
  TextField,
  NumberField,
  Picker,
  Item,
  CheckboxGroup,
  Checkbox,
  ProgressCircle,
  Text,
  View,
  ButtonGroup,
  Button,
} from "@adobe/react-spectrum";

const STATUS_OPTIONS = [
  { id: 1, name: "Enabled" },
  { id: 2, name: "Disabled" },
];

const STOCK_STATUS_OPTIONS = [
  { id: "in_stock", name: "In Stock" },
  { id: "out_of_stock", name: "Out of Stock" },
];

function initialSelectedCategoryIds(product) {
  const categoryIds = product?.custom_attributes?.find((attr) => attr.attribute_code === "category_ids")?.value ?? [];
  return categoryIds.map(String);
}

function buildCustomAttributesWithCategories(product, selectedCategoryIds) {
  const existing = product?.custom_attributes ?? [];
  const withoutCategoryIds = existing.filter((attr) => attr.attribute_code !== "category_ids");
  return [...withoutCategoryIds, { attribute_code: "category_ids", value: selectedCategoryIds }];
}

const ProductEditDialog = ({ product, categories, onSave, onCancel, isSaving }) => {
  const isNew = !product?.sku;
  const [sku, setSku] = useState(product?.sku ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product?.price ?? 0);
  const [status, setStatus] = useState(product?.status ?? 1);
  const [qty, setQty] = useState(product?.extension_attributes?.stock_item?.qty ?? 0);
  const [isInStock, setIsInStock] = useState(product?.extension_attributes?.stock_item?.is_in_stock ?? false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(() => initialSelectedCategoryIds(product));

  function handleSave() {
    onSave({
      ...product,
      sku,
      name,
      price,
      status,
      custom_attributes: buildCustomAttributesWithCategories(product, selectedCategoryIds),
      extension_attributes: {
        ...product?.extension_attributes,
        stock_item: { ...product?.extension_attributes?.stock_item, qty: Number(qty), is_in_stock: isInStock },
      },
    });
  }

  return (
    <Dialog>
      <Heading>{isNew ? "Add product" : `Edit ${product.sku}`}</Heading>
      <Divider />
      <Content>
        <Form>
          <TextField
            label="SKU"
            value={sku}
            onChange={setSku}
            isRequired
            isReadOnly={!isNew}
            description={!isNew ? "SKU cannot be changed once created" : undefined}
          />
          <TextField label="Name" value={name} onChange={setName} />
          <NumberField
            label="Price"
            value={price}
            onChange={setPrice}
            minValue={0}
            formatOptions={{ style: "currency", currency: "USD" }}
          />
          <Picker
            label="Status"
            items={STATUS_OPTIONS}
            selectedKey={String(status)}
            onSelectionChange={(key) => setStatus(Number(key))}
            description="Saves to Magento's Default Store View. The Admin grid's Status column shows the All Store Views value instead, so check the product's Default Store View scope in Magento to confirm."
          >
            {(item) => <Item key={String(item.id)}>{item.name}</Item>}
          </Picker>
          <Picker
            label="Stock Status"
            items={STOCK_STATUS_OPTIONS}
            selectedKey={isInStock ? "in_stock" : "out_of_stock"}
            onSelectionChange={(key) => setIsInStock(key === "in_stock")}
          >
            {(item) => <Item key={item.id}>{item.name}</Item>}
          </Picker>
          <NumberField label="Quantity" value={qty} onChange={setQty} minValue={0} />
          <View maxHeight="size-2400" overflow="auto">
            {categories.length === 0 ? (
              <ProgressCircle size="S" aria-label="Loading categories" isIndeterminate />
            ) : (
              <CheckboxGroup label="Categories" value={selectedCategoryIds} onChange={setSelectedCategoryIds}>
              {categories.map((category) => (
                <Checkbox key={category.id} value={String(category.id)}>
                  {"  ".repeat(category.level) + category.name}
                </Checkbox>
              ))}
            </CheckboxGroup>
            )}
          </View>
        </Form>
      </Content>
      <ButtonGroup>
        <Button variant="secondary" onPress={onCancel} isDisabled={isSaving}>
          Cancel
        </Button>
        <Button variant="accent" onPress={handleSave} isDisabled={!sku || isSaving}>
          {isSaving ? (
            <>
              <ProgressCircle size="S" aria-label="Saving" isIndeterminate marginEnd="size-100" />
              <Text>Saving...</Text>
            </>
          ) : (
            <Text>Save</Text>
          )}
        </Button>
      </ButtonGroup>
    </Dialog>
  );
};

ProductEditDialog.propTypes = {
  product: PropTypes.object,
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
      level: PropTypes.number.isRequired,
    })
  ),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isSaving: PropTypes.bool,
};

ProductEditDialog.defaultProps = {
  categories: [],
};

export default ProductEditDialog;
