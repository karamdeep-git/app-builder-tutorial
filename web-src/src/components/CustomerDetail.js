import React from "react";
import PropTypes from "prop-types";
import {
  Button,
  ButtonGroup,
  Content,
  Dialog,
  Divider,
  Flex,
  Heading,
  ProgressCircle,
  StatusLight,
  Text,
  View,
} from "@adobe/react-spectrum";

// Magento's default gender option values (customer_entity.gender).
const GENDER_LABELS = { 1: "Male", 2: "Female", 3: "Not Specified" };

// Magento stores created_at as "YYYY-MM-DD HH:mm:ss" UTC with no zone marker -
// see ProductList's formatDate for why this reshaping is needed.
function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Field({ label, value }) {
  return (
    <View>
      <Text UNSAFE_style={{ fontWeight: 600 }}>{label}</Text>
      <View>
        <Text>{value || "-"}</Text>
      </View>
    </View>
  );
}

Field.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function AddressCard({ address }) {
  const defaults = [address.isDefaultBilling && "Default billing", address.isDefaultShipping && "Default shipping"].filter(
    Boolean
  );
  const lines = [
    address.name,
    address.company,
    ...address.street,
    [address.city, [address.region, address.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    address.countryId,
    address.telephone,
  ].filter(Boolean);

  return (
    <View flex="1" minWidth="size-3000" borderWidth="thin" borderColor="dark" borderRadius="regular" padding="size-150">
      {defaults.length > 0 && <Text UNSAFE_style={{ fontWeight: 600 }}>{defaults.join(" · ")}</Text>}
      {lines.map((line, index) => (
        <View key={index}>
          <Text>{line}</Text>
        </View>
      ))}
    </View>
  );
}

AddressCard.propTypes = {
  address: PropTypes.object.isRequired,
};

function CustomerDetail({ customer, groupName, websiteName, isDeleting, deleteError, onRequestDelete, onClose }) {
  if (!customer) return null;

  return (
    <Dialog size="L">
      <Heading>{customer.name}</Heading>
      <Divider />
      <Content>
        {deleteError && (
          <View marginBottom="size-200">
            <StatusLight variant="negative">{deleteError}</StatusLight>
          </View>
        )}
        {isDeleting && (
          <Flex direction="row" gap="size-75" alignItems="center" marginBottom="size-200">
            <ProgressCircle size="S" aria-label="Deleting customer" isIndeterminate />
            <Text>Deleting...</Text>
          </Flex>
        )}
        <Flex direction="row" gap="size-400" wrap="wrap" marginBottom="size-300">
          <Field label="Email" value={customer.email} />
          <Field label="Customer ID" value={customer.id} />
          <Field label="Group" value={groupName} />
          <Field label="Website" value={websiteName} />
          <Field label="Account created in" value={customer.createdIn} />
          <Field label="Customer since" value={formatDate(customer.createdAt)} />
          <Field label="Last updated" value={formatDate(customer.updatedAt)} />
          {customer.dob && <Field label="Date of birth" value={customer.dob} />}
          {customer.gender != null && <Field label="Gender" value={GENDER_LABELS[customer.gender]} />}
        </Flex>

        <Heading level={4}>Addresses</Heading>
        {customer.addresses.length > 0 ? (
          <Flex direction="row" gap="size-200" wrap="wrap">
            {customer.addresses.map((address, index) => (
              <AddressCard key={address.id ?? index} address={address} />
            ))}
          </Flex>
        ) : (
          <Text>No saved addresses.</Text>
        )}
      </Content>
      <ButtonGroup>
        <Button variant="negative" onPress={onRequestDelete} isDisabled={isDeleting}>
          Delete customer
        </Button>
        <Button variant="secondary" onPress={onClose}>
          Close
        </Button>
      </ButtonGroup>
    </Dialog>
  );
}

CustomerDetail.propTypes = {
  customer: PropTypes.object,
  groupName: PropTypes.string,
  websiteName: PropTypes.string,
  isDeleting: PropTypes.bool,
  deleteError: PropTypes.string,
  onRequestDelete: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default CustomerDetail;
