/*
Copyright The CryptOS Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconAudit,
  Notice,
  StatusBadge,
} from "@cryptos-pki/ui";
import { useCallback, useEffect, useState } from "react";

import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import {
  listNodeAuditEvents,
  type NodeAuditEvent,
  type NodeOutcome,
  verifyNodeAuditChain,
  type VerifyNodeAuditChainResult,
} from "@/lib/node-audit";

const OUTCOME_STATUS: Record<NodeOutcome, "denied" | "error" | "muted" | "ok"> = {
  DENIED: "denied",
  ERROR: "error",
  OK: "ok",
  UNSPECIFIED: "muted",
};

// NodeAuditLog shows a managed node's own hash-chained audit log (distinct
// from the manager's own audit, shown on the Audit page) and a "Verify chain"
// action that reports the node's own result.
export const NodeAuditLog = ({ nodeName }: { nodeName: string }) => {
  const [entries, setEntries] = useState<NodeAuditEvent[]>([]);
  const [nextPageToken, setNextPageToken] = useState("");
  const [status, setStatus] = useState<"error" | "loading" | "ready">("loading");
  const [loadError, setLoadError] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<null | VerifyNodeAuditChainResult>(null);
  const [verifyError, setVerifyError] = useState("");

  const load = useCallback(
    async (pageToken: string) => {
      setStatus("loading");
      try {
        const page = await listNodeAuditEvents(nodeName, { pageToken });
        setEntries((previous) => (pageToken ? [...previous, ...page.entries] : page.entries));
        setNextPageToken(page.nextPageToken);
        setStatus("ready");
      } catch (error) {
        setLoadError(fleetErrorMessage(error, "Failed to load the node's audit log"));
        setStatus("error");
      }
    },
    [nodeName],
  );

  useEffect(() => {
    void load("");
  }, [load]);

  const verify = async () => {
    setVerifying(true);
    setVerifyError("");
    try {
      setVerifyResult(await verifyNodeAuditChain(nodeName));
    } catch (error) {
      setVerifyError(fleetErrorMessage(error, "Failed to verify the node's audit chain"));
    } finally {
      setVerifying(false);
    }
  };

  const columns: DataTableColumn<NodeAuditEvent>[] = [
    { cell: (e) => e.seq, header: "Seq", id: "seq" },
    { cell: (e) => e.ts.slice(0, 19).replace("T", " "), header: "Time", id: "ts" },
    { cell: (e) => e.actorSubject, header: "Actor", id: "actor" },
    {
      cell: (e) => e.rpcMethod.split("/").at(-1),
      header: "Action",
      id: "rpcMethod",
    },
    {
      cell: (e) => <StatusBadge status={OUTCOME_STATUS[e.outcome]}>{e.outcome}</StatusBadge>,
      header: "Outcome",
      id: "outcome",
    },
    { cell: (e) => e.summary, header: "Summary", id: "summary" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button disabled={verifying} onClick={() => void verify()} size="sm" variant="outline">
          {verifying ? "Verifying…" : "Verify chain"}
        </Button>
      </div>
      {verifyError ? (
        <Notice role="alert" tone="danger">
          {verifyError}
        </Notice>
      ) : null}
      {verifyResult ? (
        <Notice role="status" tone={verifyResult.intact ? "success" : "danger"}>
          {verifyResult.intact
            ? `Chain intact across ${verifyResult.entryCount} entries.`
            : `Chain broken at sequence ${verifyResult.firstBrokenSequence}: ${verifyResult.reason}`}
        </Notice>
      ) : null}
      <DataTable
        columns={columns}
        empty={
          <EmptyState
            body="This node has not recorded any audit events yet."
            icon={IconAudit}
            title="No audit events"
          />
        }
        error={
          <EmptyState
            body={loadError}
            icon={IconAudit}
            title="Couldn't load the audit log"
            tone="danger"
          />
        }
        footer={
          nextPageToken && status === "ready" ? (
            <Button onClick={() => void load(nextPageToken)} size="sm" variant="outline">
              Load more
            </Button>
          ) : null
        }
        label="Audit log"
        rowKey={(e) => String(e.seq)}
        rows={entries}
        status={status}
      />
    </div>
  );
};
