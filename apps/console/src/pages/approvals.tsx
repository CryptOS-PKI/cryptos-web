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

import { DataTable, type DataTableColumn, EmptyState, inputClasses, Notice } from "@cryptos-pki/ui";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ApprovalDecideDialog } from "@/components/approval-decide-dialog";
import { useAuth } from "@/context/auth";
import { type ApprovalRow, type ApprovalStatus, canDecide, listApprovals } from "@/lib/approvals";

const when = (ts: string): string => (ts ? ts.replace("T", " ").slice(0, 16) : "-");

const STATUSES: ApprovalStatus[] = ["pending", "approved", "denied", "expired", "used"];

const statusTone: Record<string, string> = {
  approved: "text-success",
  denied: "text-destructive",
  pending: "text-warning",
};

// ApprovalsPage is where a person decides the step-up requests MCP agents
// raise. The manager's approve_url links here with ?id=<approval>, so a deep
// link shows every status: the approval may already be decided or expired by
// the time the operator opens it.
export const ApprovalsPage = () => {
  const { operator } = useAuth();
  const level = operator?.level ?? "viewer";
  const [params] = useSearchParams();
  const focusId = params.get("id") ?? "";

  const [status, setStatus] = useState(focusId ? "" : "pending");
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [decision, setDecision] = useState<{ approve: boolean; target: ApprovalRow } | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setRows(await listApprovals({ status }));
    } catch (error_: unknown) {
      setLoadError(error_ instanceof Error ? error_.message : "Failed to load approvals");
    } finally {
      setLoaded(true);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const focusMissing =
    focusId !== "" && status === "" && loaded && !loadError && !rows.some((r) => r.id === focusId);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const gateReason = (r: ApprovalRow): string => {
    if (r.status !== "pending") return `Already ${r.status}`;
    return canDecide(level, r) ? "" : `Needs ${r.requiredLevel} level; you are ${level}`;
  };

  const columns: DataTableColumn<ApprovalRow>[] = [
    {
      cell: (r) => r.tool,
      className: "font-semibold",
      header: "Tool",
      id: "tool",
      mobile: "title",
    },
    { cell: (r) => r.summary, header: "Summary", id: "summary" },
    {
      cell: (r) => r.requestedByCn,
      className: "break-all",
      header: "Requested by",
      id: "requestedBy",
    },
    { cell: (r) => r.keyId || "-", header: "Key", id: "key" },
    { cell: (r) => r.requiredLevel, header: "Required", id: "required" },
    { cell: (r) => when(r.createdAt), header: "Created", id: "created" },
    { cell: (r) => when(r.expiresAt), header: "Expires", id: "expires" },
    {
      cell: (r) => (
        <>
          <span className={statusTone[r.status] ?? "text-muted-foreground"}>{r.status}</span>
          {r.decidedByCn ? (
            <span className="block text-[11px] text-muted-foreground">by {r.decidedByCn}</span>
          ) : null}
        </>
      ),
      header: "Status",
      id: "status",
    },
    {
      cell: (r) => {
        const reason = gateReason(r);
        return (
          <span className="inline-flex gap-2 whitespace-nowrap" title={reason || undefined}>
            <button
              className="rounded-md border px-2.5 py-1 text-xs hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              disabled={reason !== ""}
              onClick={() => setDecision({ approve: true, target: r })}
              type="button"
            >
              {"Approve…"}
            </button>
            <button
              className="rounded-md border px-2.5 py-1 text-xs hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              disabled={reason !== ""}
              onClick={() => setDecision({ approve: false, target: r })}
              type="button"
            >
              {"Deny…"}
            </button>
          </span>
        );
      },
      header: <span className="sr-only">Actions</span>,
      id: "actions",
      mobile: "action",
    },
  ];

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount} pending of {rows.length} shown
          </p>
        </div>
        <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          Status
          <select
            className={inputClasses}
            onChange={(e) => setStatus(e.target.value)}
            value={status}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="">all</option>
          </select>
        </label>
      </div>

      <Notice className="max-w-3xl" role="note" tone="warning">
        An agent asks for approval before a tool that changes the fleet runs. Approving lets that
        exact request through once; check that the approval ID and summary in the confirmation match
        what the agent showed you. You can decide only requests at or below your own level.
      </Notice>

      {loadError ? (
        <Notice role="alert" tone="danger">
          {loadError}
        </Notice>
      ) : null}
      {focusMissing ? (
        <p className="font-mono text-sm text-muted-foreground">Approval {focusId} was not found.</p>
      ) : null}

      <DataTable
        columns={columns}
        empty={
          <EmptyState
            body="A request appears here when an agent calls a tool that needs a person to approve it."
            title={status === "pending" ? "No approvals are waiting." : "No approvals match."}
          />
        }
        highlightKey={focusId || undefined}
        label="Approvals"
        rowKey={(r) => r.id}
        rows={rows}
      />

      {decision ? (
        <ApprovalDecideDialog
          approve={decision.approve}
          onClose={() => setDecision(null)}
          onDecided={() => void load()}
          target={decision.target}
        />
      ) : null}
    </section>
  );
};
