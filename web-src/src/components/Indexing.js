import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Cell,
  Column,
  Divider,
  Flex,
  Heading,
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

const POLL_INTERVAL_MS = 2000;

const STATUS_ICON = {
  pending: "○",
  running: null, // rendered as a spinner instead
  success: "✓",
  failed: "✗",
};

function statusVariant(status) {
  if (status === "invalid") return "negative";
  if (status === "working") return "notice";
  return "positive";
}

function IndexerJobRow({ indexer }) {
  const variant = { success: "positive", failed: "negative", pending: "neutral" }[indexer.status];

  return (
    <View paddingY="size-100" borderBottomWidth="thin" borderBottomColor="dark">
      <Flex direction="row" justifyContent="space-between" alignItems="center">
        <Flex direction="row" gap="size-100" alignItems="center">
          {indexer.status === "running" ? (
            <ProgressCircle size="S" isIndeterminate aria-label="Running" />
          ) : (
            <Text UNSAFE_style={{ width: "1.2em", display: "inline-block" }}>{STATUS_ICON[indexer.status]}</Text>
          )}
          <Text>{indexer.title}</Text>
        </Flex>
        {indexer.status !== "pending" && indexer.status !== "running" && (
          <StatusLight variant={variant}>{indexer.status}</StatusLight>
        )}
      </Flex>
      {indexer.status === "failed" && (
        <View marginTop="size-100" marginStart="size-300" UNSAFE_style={{ fontFamily: "monospace", fontSize: "12px" }}>
          <Text>Error: {indexer.error || "(no details captured)"}</Text>
        </View>
      )}
    </View>
  );
}

function Indexing({ ims }) {
  const [indexers, setIndexers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [job, setJob] = useState(null);
  const pollRef = useRef(null);

  const authHeaders = {
    ...(ims?.token ? { authorization: `Bearer ${ims.token}` } : {}),
    ...(ims?.org ? { "x-gw-ims-org-id": ims.org } : {}),
  };

  const loadIndexers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await actionWebInvoke(allActions["indexer/list"], authHeaders, {}, { method: "GET" });
      setIndexers(result?.response?.indexers ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ims?.token]);

  useEffect(() => {
    loadIndexers();
  }, [loadIndexers]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pollStatus(jobId) {
    pollRef.current = setInterval(async () => {
      try {
        const result = await actionWebInvoke(
          allActions["indexer/reindex-status"],
          authHeaders,
          { jobId },
          { method: "GET" }
        );
        const latestJob = result?.response?.job;
        setJob(latestJob);
        if (latestJob && latestJob.status !== "running") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          loadIndexers();
        }
      } catch (e) {
        setError(e.message);
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, POLL_INTERVAL_MS);
  }

  async function startReindex(indexerIds) {
    setError(null);
    // Show the "pending" panel immediately - the POST below still has to round
    // -trip (OAuth signing + network) before a jobId comes back, and without
    // this the UI looks completely unresponsive for that whole gap.
    const targets = indexerIds.length > 0 ? indexers.filter((i) => indexerIds.includes(i.indexer_id)) : indexers;
    setJob({
      jobId: null,
      status: "running",
      indexers: targets.map((i) => ({ id: i.indexer_id, title: i.title, status: "pending" })),
    });
    try {
      const result = await actionWebInvoke(
        allActions["indexer/reindex"],
        authHeaders,
        { indexerIds },
        { method: "POST" }
      );
      const jobId = result?.response?.jobId;
      setJob((current) => ({ ...current, jobId }));
      pollStatus(jobId);
    } catch (e) {
      setError(e.message);
      setJob(null);
    }
  }

  function selectedIndexerIds() {
    if (selectedKeys === "all") return indexers.map((i) => i.indexer_id);
    return indexers.map((i) => i.indexer_id).filter((id) => selectedKeys.has(id));
  }

  const isRunning = job?.status === "running";

  return (
    <View width="size-8000">
      <Flex direction="row" justifyContent="space-between" alignItems="center" marginBottom="size-200">
        <Heading level={1}>Indexing</Heading>
        <Button variant="secondary" onPress={() => startReindex([])} isDisabled={isRunning}>
          Reindex All
        </Button>
      </Flex>

      {error && (
        <View marginBottom="size-200">
          <StatusLight variant="negative">{error}</StatusLight>
        </View>
      )}

      <Flex direction="row" gap="size-150" marginBottom="size-150" alignItems="center">
        <Button
          variant="secondary"
          isDisabled={isRunning}
          onPress={() => setSelectedKeys(new Set(indexers.map((i) => i.indexer_id)))}
        >
          Select All
        </Button>
        <Button variant="secondary" isDisabled={isRunning} onPress={() => setSelectedKeys(new Set())}>
          Clear Selection
        </Button>
        <Button
          variant="cta"
          isDisabled={selectedIndexerIds().length === 0 || isRunning}
          onPress={() => startReindex(selectedIndexerIds())}
        >
          Reindex Selected ({selectedIndexerIds().length})
        </Button>
      </Flex>

      {isLoading && indexers.length === 0 ? (
        <ProgressCircle aria-label="Loading indexers" isIndeterminate />
      ) : (
        <TableView
          aria-label="Indexers"
          density="compact"
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          isDisabled={isRunning}
        >
          <TableHeader>
            <Column key="title" minWidth={220}>
              Indexer
            </Column>
            <Column key="status" minWidth={110}>
              Status
            </Column>
            <Column key="scheduled" minWidth={110}>
              Scheduled
            </Column>
            <Column key="latest_updated" minWidth={180}>
              Last Updated
            </Column>
            <Column key="actions" align="end" width={100}>
              Actions
            </Column>
          </TableHeader>
          <TableBody items={indexers}>
            {(indexer) => (
              <Row key={indexer.indexer_id}>
                <Cell>{indexer.title}</Cell>
                <Cell>
                  <StatusLight variant={statusVariant(indexer.status)}>{indexer.status}</StatusLight>
                </Cell>
                <Cell>{indexer.scheduled ? "Yes" : "No"}</Cell>
                <Cell>{indexer.latest_updated ?? "-"}</Cell>
                <Cell>
                  <Flex direction="row" justifyContent="end">
                    <Button
                      variant="secondary"
                      isDisabled={isRunning}
                      onPress={() => startReindex([indexer.indexer_id])}
                      aria-label={`Reindex ${indexer.title}`}
                    >
                      Reindex
                    </Button>
                  </Flex>
                </Cell>
              </Row>
            )}
          </TableBody>
        </TableView>
      )}

      {job && (
        <View marginTop="size-300">
          <Divider size="S" />
          <View marginTop="size-200">
            <Flex direction="row" gap="size-100" alignItems="center">
              <Heading level={3} marginTop="size-0" marginBottom="size-0">
                {job.status === "running" ? "Running..." : "Execution completed"}
              </Heading>
              {job.status === "running" && <ProgressCircle size="S" isIndeterminate aria-label="Reindexing" />}
            </Flex>
            {job.indexers.map((indexer) => (
              <IndexerJobRow key={indexer.id} indexer={indexer} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export default Indexing;
