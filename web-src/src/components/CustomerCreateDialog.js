import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Button,
  ButtonGroup,
  Content,
  Dialog,
  Divider,
  Form,
  Heading,
  Item,
  Picker,
  ProgressCircle,
  StatusLight,
  Text,
  TextField,
  View,
} from "@adobe/react-spectrum";

// Same loose check customer/create runs server-side - Magento does the
// authoritative validation and its message comes back as `error`.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function firstStoreViewId(storeViews, websiteId) {
  return storeViews.find((store) => store.websiteId === websiteId)?.id ?? null;
}

// No password field on purpose: Magento emails the new customer a link to set
// their own, so admins never choose or see customer passwords.
function CustomerCreateDialog({ options, isSaving, error, onSave, onCancel }) {
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [websiteId, setWebsiteId] = useState(() => options.websites[0]?.id ?? null);
  const [groupId, setGroupId] = useState(() => options.defaultGroupId ?? options.groups[0]?.id ?? null);
  const [storeId, setStoreId] = useState(() => firstStoreViewId(options.storeViews, options.websites[0]?.id));

  const storeViewsForWebsite = options.storeViews.filter((store) => store.websiteId === websiteId);
  const trimmedEmail = email.trim();
  const isEmailValid = EMAIL_PATTERN.test(trimmedEmail);
  const canSave = Boolean(firstname.trim() && lastname.trim() && isEmailValid) && !isSaving;

  function handleWebsiteChange(key) {
    const id = Number(key);
    setWebsiteId(id);
    // A store view from a different website would make Magento reject the
    // save ("The store view is not in the associated website").
    setStoreId(firstStoreViewId(options.storeViews, id));
  }

  function handleSave() {
    if (!canSave) return;
    onSave({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: trimmedEmail,
      websiteId,
      groupId,
      storeId,
    });
  }

  return (
    <Dialog>
      <Heading>Add customer</Heading>
      <Divider />
      <Content>
        {error && (
          <View marginBottom="size-200">
            <StatusLight variant="negative">{error}</StatusLight>
          </View>
        )}
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <TextField label="First name" value={firstname} onChange={setFirstname} isRequired autoFocus maxLength={255} />
          <TextField label="Last name" value={lastname} onChange={setLastname} isRequired maxLength={255} />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            isRequired
            maxLength={254}
            isInvalid={Boolean(trimmedEmail) && !isEmailValid}
            errorMessage="Enter a valid email address"
          />
          <Picker
            label="Website"
            items={options.websites}
            selectedKey={websiteId != null ? String(websiteId) : null}
            onSelectionChange={handleWebsiteChange}
          >
            {(website) => <Item key={String(website.id)}>{website.name}</Item>}
          </Picker>
          <Picker
            label="Customer group"
            items={options.groups}
            selectedKey={groupId != null ? String(groupId) : null}
            onSelectionChange={(key) => setGroupId(Number(key))}
          >
            {(group) => <Item key={String(group.id)}>{group.code}</Item>}
          </Picker>
          <Picker
            label="Send welcome email from"
            items={storeViewsForWebsite}
            selectedKey={storeId != null ? String(storeId) : null}
            onSelectionChange={(key) => setStoreId(Number(key))}
            description="Magento emails the customer a link to set their own password. This needs mail sending configured in Magento; the account is created either way."
          >
            {(store) => <Item key={String(store.id)}>{store.name}</Item>}
          </Picker>
        </Form>
      </Content>
      <ButtonGroup>
        <Button variant="secondary" onPress={onCancel} isDisabled={isSaving}>
          Cancel
        </Button>
        <Button variant="accent" onPress={handleSave} isDisabled={!canSave}>
          {isSaving ? (
            <>
              <ProgressCircle size="S" aria-label="Creating customer" isIndeterminate marginEnd="size-100" />
              <Text>Creating...</Text>
            </>
          ) : (
            <Text>Create customer</Text>
          )}
        </Button>
      </ButtonGroup>
    </Dialog>
  );
}

CustomerCreateDialog.propTypes = {
  options: PropTypes.shape({
    groups: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.number, code: PropTypes.string })).isRequired,
    websites: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.number, name: PropTypes.string })).isRequired,
    storeViews: PropTypes.arrayOf(
      PropTypes.shape({ id: PropTypes.number, name: PropTypes.string, websiteId: PropTypes.number })
    ).isRequired,
    defaultGroupId: PropTypes.number,
  }).isRequired,
  isSaving: PropTypes.bool,
  error: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default CustomerCreateDialog;
