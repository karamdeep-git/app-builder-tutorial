import React, { useCallback, useEffect, useState } from "react";
import {
  ActionButton,
  AlertDialog,
  Cell,
  Column,
  DialogContainer,
  Flex,
  Heading,
  ProgressCircle,
  Row,
  StatusLight,
  TableBody,
  TableHeader,
  TableView,
  View,
} from "@adobe/react-spectrum";
import LockClosed from "@spectrum-icons/workflow/LockClosed";
import LockOpen from "@spectrum-icons/workflow/LockOpen";

import allActions from "../config.json";
import actionWebInvoke from "../utils";

function AdminUserManager({ ims, currentUsername }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [deactivatingUser, setDeactivatingUser] = useState(null);

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await actionWebInvoke(allActions["admin-users/list"], authHeaders, {}, { method: "GET" });
      setUsers(result?.response?.users ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ims?.token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function setUserFields(userId, fields) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...fields } : u)));
  }

  async function handleActivate(user) {
    setError(null);
    setMessage(null);
    // Optimistic: flip this row to Active immediately, the async loader covers
    // the round-trip, and a failed request is corrected by the catch below.
    // isSaving lives on the row object itself (not separate component state) so
    // TableView's collection sees a real item change and actually re-renders the
    // row when the request finishes - a sibling state variable doesn't do that.
    setUserFields(user.id, { isActive: true, isSaving: true });
    try {
      await actionWebInvoke(
        allActions["admin-users/activate"],
        authHeaders,
        { userIds: [user.id] },
        { method: "POST" }
      );
      setMessage(`"${user.username}" activated.`);
      setUserFields(user.id, { isSaving: false });
    } catch (e) {
      setError(e.message);
      setUserFields(user.id, { isActive: false, isSaving: false });
    }
  }

  async function handleDeactivate(user) {
    setError(null);
    setMessage(null);
    setDeactivatingUser(null);
    setUserFields(user.id, { isActive: false, isSaving: true });
    try {
      await actionWebInvoke(
        allActions["admin-users/deactivate"],
        authHeaders,
        { userIds: [user.id] },
        { method: "POST" }
      );
      setMessage(`"${user.username}" deactivated.`);
      setUserFields(user.id, { isSaving: false });
    } catch (e) {
      setError(e.message);
      setUserFields(user.id, { isActive: true, isSaving: false });
    }
  }

  const visibleUsers = users.filter((user) => user.username !== currentUsername);
  const isAnySaving = visibleUsers.some((user) => user.isSaving);

  return (
    <View width="100%" maxWidth="size-8000">
      <Heading level={1}>Admin Users</Heading>
      <View marginBottom="size-200">
        <StatusLight variant="info">You're signed in as &quot;{currentUsername}&quot; - not shown below.</StatusLight>
      </View>

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

      {isLoading && visibleUsers.length === 0 ? (
        <ProgressCircle aria-label="Loading admin users" isIndeterminate />
      ) : (
        <TableView aria-label="Admin users" density="compact">
          <TableHeader>
            <Column key="username" minWidth={180}>
              Username
            </Column>
            <Column key="name" minWidth={240}>
              Name
            </Column>
            <Column key="email" minWidth={320}>
              Email
            </Column>
            <Column key="status" minWidth={140}>
              Status
            </Column>
            <Column key="actions" align="end" minWidth={160}>
              Actions
            </Column>
          </TableHeader>
          <TableBody items={visibleUsers}>
            {(user) => (
              <Row key={user.id}>
                <Cell>{user.username}</Cell>
                <Cell>
                  {user.firstname} {user.lastname}
                </Cell>
                <Cell>{user.email}</Cell>
                <Cell>
                  <StatusLight variant={user.isActive ? "positive" : "neutral"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </StatusLight>
                </Cell>
                <Cell>
                  <Flex direction="row" justifyContent="end" alignItems="center">
                    {user.isSaving ? (
                      <ProgressCircle size="S" aria-label={`Updating ${user.username}`} isIndeterminate />
                    ) : user.isActive ? (
                      <ActionButton
                        isQuiet
                        onPress={() => setDeactivatingUser(user)}
                        isDisabled={isAnySaving}
                        aria-label={`Deactivate ${user.username}`}
                      >
                        <LockClosed />
                      </ActionButton>
                    ) : (
                      <ActionButton
                        isQuiet
                        onPress={() => handleActivate(user)}
                        isDisabled={isAnySaving}
                        aria-label={`Activate ${user.username}`}
                      >
                        <LockOpen />
                      </ActionButton>
                    )}
                  </Flex>
                </Cell>
              </Row>
            )}
          </TableBody>
        </TableView>
      )}

      <DialogContainer onDismiss={() => setDeactivatingUser(null)}>
        {deactivatingUser && (
          <AlertDialog
            title="Deactivate admin user"
            variant="destructive"
            primaryActionLabel="Deactivate"
            cancelLabel="Cancel"
            isPrimaryActionDisabled={isAnySaving}
            onPrimaryAction={() => handleDeactivate(deactivatingUser)}
            onCancel={() => setDeactivatingUser(null)}
          >
            Are you sure you want to deactivate &quot;{deactivatingUser.username}&quot;? They will immediately lose
            the ability to log in to Magento Admin, including via the API. Magento will refuse this if it would
            leave no active admin users.
          </AlertDialog>
        )}
      </DialogContainer>
    </View>
  );
}

export default AdminUserManager;
