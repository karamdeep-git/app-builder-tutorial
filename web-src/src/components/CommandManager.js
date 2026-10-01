import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionButton,
  AlertDialog,
  Button,
  Checkbox,
  CheckboxGroup,
  Content,
  DialogContainer,
  Divider,
  Flex,
  Heading,
  ProgressCircle,
  StatusLight,
  Text,
  View,
} from "@adobe/react-spectrum";

import allActions from "../config.json";
import actionWebInvoke from "../utils";

const POLL_INTERVAL_MS = 2000;

const STATUS_ICON = {
  pending: "○",
  running: null, // rendered as a spinner instead
  success: "✓",
  failed: "✗",
  skipped: "⊘",
};

function CommandRow({ command }) {
  const variant = { success: "positive", failed: "negative", skipped: "neutral", pending: "neutral" }[command.status];

  return (
    <View paddingY="size-100" borderBottomWidth="thin" borderBottomColor="dark">
      <Flex direction="row" justifyContent="space-between" alignItems="center">
        <Flex direction="row" gap="size-100" alignItems="center">
          {command.status === "running" ? (
            <ProgressCircle size="S" isIndeterminate aria-label="Running" />
          ) : (
            <Text UNSAFE_style={{ width: "1.2em", display: "inline-block" }}>{STATUS_ICON[command.status]}</Text>
          )}
          <Text>{command.label}</Text>
        </Flex>
        {command.status !== "pending" && command.status !== "running" && (
          <StatusLight variant={variant}>{command.status}</StatusLight>
        )}
      </Flex>
      {command.status === "failed" && (
        <View marginTop="size-100" marginStart="size-300" UNSAFE_style={{ fontFamily: "monospace", fontSize: "12px" }}>
          <Text>Exit Code: {command.exitCode}</Text>
          <View marginTop="size-50">
            <Text>Error: {command.stderr || "(no output captured)"}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function JobDetails({ job }) {
  if (!job) return null;
  return (
    <View>
      {job.commands.map((command) => (
        <CommandRow key={command.id} command={command} />
      ))}
    </View>
  );
}

function CommandManager({ ims, currentUser }) {
  const [commands, setCommands] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [stopOnFailure, setStopOnFailure] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [expandedHistoryJobId, setExpandedHistoryJobId] = useState(null);
  const pollRef = useRef(null);

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  const loadCommands = useCallback(async () => {
    try {
      const result = await actionWebInvoke(allActions["commands/list"], authHeaders, {}, { method: "GET" });
      setCommands(result?.response?.commands ?? []);
    } catch (e) {
      setError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ims?.token]);

  const loadHistory = useCallback(async () => {
    try {
      const result = await actionWebInvoke(allActions["commands/history"], authHeaders, {}, { method: "GET" });
      setHistory(result?.response?.jobs ?? []);
    } catch (e) {
      setError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ims?.token]);

  useEffect(() => {
    loadCommands();
    loadHistory();
  }, [loadCommands, loadHistory]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pollStatus(jobId) {
    pollRef.current = setInterval(async () => {
      try {
        const result = await actionWebInvoke(
          allActions["commands/status"],
          authHeaders,
          { jobId },
          { method: "GET" }
        );
        const latestJob = result?.response?.job;
        setJob(latestJob);
        if (latestJob && latestJob.status !== "running") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          loadHistory();
        }
      } catch (e) {
        setError(e.message);
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleConfirmRun() {
    setIsConfirmOpen(false);
    setIsStarting(true);
    setError(null);
    setJob(null);
    try {
      const result = await actionWebInvoke(
        allActions["commands/run"],
        authHeaders,
        { commandIds: orderedSelectedIds(), stopOnFailure, triggeredBy: currentUser ?? "unknown" },
        { method: "POST" }
      );
      const jobId = result?.response?.jobId;
      setJob({
        jobId,
        status: "running",
        commands: orderedSelectedIds().map((id) => ({
          id,
          label: commands.find((c) => c.id === id)?.label ?? id,
          status: "pending",
        })),
      });
      pollStatus(jobId);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsStarting(false);
    }
  }

  function orderedSelectedIds() {
    // Preserve the server's canonical order, not selection click order.
    return commands.map((c) => c.id).filter((id) => selectedIds.includes(id));
  }

  const isRunning = job?.status === "running" || isStarting;

  return (
    <View width="size-6000">
      <Heading level={1}>Magento Command Manager</Heading>

      {error && (
        <View marginBottom="size-200">
          <StatusLight variant="negative">{error}</StatusLight>
        </View>
      )}

      <CheckboxGroup label="Commands" value={selectedIds} onChange={setSelectedIds} isDisabled={isRunning}>
        {commands.map((command) => (
          <Checkbox key={command.id} value={command.id}>
            {command.label}
          </Checkbox>
        ))}
      </CheckboxGroup>

      <Flex direction="row" gap="size-150" marginTop="size-150">
        <Button variant="secondary" isDisabled={isRunning} onPress={() => setSelectedIds(commands.map((c) => c.id))}>
          Select All
        </Button>
        <Button variant="secondary" isDisabled={isRunning} onPress={() => setSelectedIds([])}>
          Clear Selection
        </Button>
      </Flex>

      <Checkbox
        marginTop="size-200"
        isSelected={stopOnFailure}
        onChange={setStopOnFailure}
        isDisabled={isRunning}
      >
        Stop on first failure
      </Checkbox>

      <View marginTop="size-200">
        <Button
          variant="cta"
          isDisabled={selectedIds.length === 0 || isRunning}
          onPress={() => setIsConfirmOpen(true)}
        >
          {isStarting ? <ProgressCircle size="S" isIndeterminate aria-label="Starting" /> : "Run Selected Commands"}
        </Button>
      </View>

      <DialogContainer onDismiss={() => setIsConfirmOpen(false)}>
        {isConfirmOpen && (
          <AlertDialog
            title="Run Magento commands?"
            variant="warning"
            primaryActionLabel="Run Commands"
            cancelLabel="Cancel"
            onPrimaryAction={handleConfirmRun}
            onCancel={() => setIsConfirmOpen(false)}
          >
            This will run the following commands, in this order, on your live Magento instance:
            <View marginTop="size-150">
              <ul>
                {orderedSelectedIds().map((id) => (
                  <li key={id}>{commands.find((c) => c.id === id)?.label ?? id}</li>
                ))}
              </ul>
            </View>
            Maintenance mode will be enabled automatically if it isn&apos;t already, and restored to its original
            state when finished.
          </AlertDialog>
        )}
      </DialogContainer>

      {job && (
        <View marginTop="size-300">
          <Divider size="S" />
          <View marginTop="size-200">
            <Heading level={3}>{job.status === "running" ? "Running..." : "Execution completed"}</Heading>
            <JobDetails job={job} />
          </View>
        </View>
      )}

      <View marginTop="size-400">
        <Divider size="S" />
        <Flex direction="row" justifyContent="space-between" alignItems="center" marginTop="size-200">
          <Heading level={3}>Execution History</Heading>
          <ActionButton onPress={loadHistory}>Refresh</ActionButton>
        </Flex>
        {history.length === 0 ? (
          <Content>No commands have been run yet.</Content>
        ) : (
          history.map((pastJob) => (
            <View key={pastJob.jobId} borderBottomWidth="thin" borderBottomColor="dark" paddingY="size-100">
              <Flex
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                onClick={() => setExpandedHistoryJobId(expandedHistoryJobId === pastJob.jobId ? null : pastJob.jobId)}
                UNSAFE_style={{ cursor: "pointer" }}
              >
                <Text>
                  {pastJob.triggeredBy} - {pastJob.startedAt} ({pastJob.commands?.length ?? 0} command
                  {pastJob.commands?.length === 1 ? "" : "s"})
                </Text>
                <StatusLight
                  variant={
                    { success: "positive", failed: "negative", partial: "notice", running: "info" }[pastJob.status]
                  }
                >
                  {pastJob.status}
                </StatusLight>
              </Flex>
              {expandedHistoryJobId === pastJob.jobId && (
                <View marginTop="size-100">
                  <Text>
                    Maintenance mode: {String(pastJob.maintenanceMode?.before)} -&gt;{" "}
                    {String(pastJob.maintenanceMode?.after)}
                  </Text>
                  <JobDetails job={pastJob} />
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

export default CommandManager;
