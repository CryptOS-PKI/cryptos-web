/*
Apache License 2.0

Copyright 2026 Shane

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

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ApprovalDecideDialog } from "@/components/approval-decide-dialog";
import { useAuth } from "@/context/auth";
import { type ApprovalRow, type ApprovalStatus, canDecide, listApprovals } from "@/lib/approvals";
import { cn } from "@/lib/utils";

const th =
  "px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground";
const td = "px-3 py-2 font-mono text-xs";

const when = (ts: string): string => (ts ? ts.replace("T", " ").slice(0, 16) : "-");

const STATUSES: ApprovalStatus[] = ["pending", "approved", "denied", "expired", "used"];

const statusTone: Record<string, string> = {
  approved: "text-success",
  denied: "text-destructive",
  pending: "text-warning",
};

const COLUMNS = 9;

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

  const focusRef = useCallback((row: HTMLTableRowElement | null) => {
    // jsdom and some older engines lack scrollIntoView.
    row?.scrollIntoView?.({ block: "center" });
  }, []);

  const focusMissing =
    focusId !== "" && status === "" && loaded && !loadError && !rows.some((r) => r.id === focusId);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const gateReason = (r: ApprovalRow): string => {
    if (r.status !== "pending") return `Already ${r.status}`;
    return canDecide(level, r) ? "" : `Needs ${r.requiredLevel} level; you are ${level}`;
  };

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
            className="rounded-md border bg-background px-2 py-1 text-xs text-foreground"
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

      <p
        className="max-w-3xl rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground"
        role="note"
      >
        An agent asks for approval before a tool that changes the fleet runs. Approving lets that
        exact request through once; check that the summary and request digest match what the agent
        showed you. You can decide only requests at or below your own level.
      </p>

      {loadError ? (
        <p className="font-mono text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}
      {focusMissing ? (
        <p className="font-mono text-sm text-muted-foreground">Approval {focusId} was not found.</p>
      ) : null}

      <div className="w-full overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse">
          <thead className="border-b bg-secondary/50">
            <tr>
              <th className={th}>Tool</th>
              <th className={th}>Summary</th>
              <th className={th}>Requested by</th>
              <th className={th}>Key</th>
              <th className={th}>Required</th>
              <th className={th}>Created</th>
              <th className={th}>Expires</th>
              <th className={th}>Status</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                  colSpan={COLUMNS}
                >
                  <p className="text-foreground">
                    {status === "pending" ? "No approvals are waiting." : "No approvals match."}
                  </p>
                  <p className="mx-auto mt-1 max-w-xl">
                    A request appears here when an agent calls a tool that needs a person to approve
                    it.
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const focused = r.id === focusId;
                const reason = gateReason(r);
                return (
                  <tr
                    aria-current={focused ? "true" : undefined}
                    className={cn(
                      "border-b last:border-0",
                      focused &&
                        "bg-primary/10 outline outline-2 -outline-offset-2 outline-primary",
                    )}
                    key={r.id}
                    ref={focused ? focusRef : undefined}
                  >
                    <td className={`${td} font-semibold`}>{r.tool}</td>
                    <td className="max-w-md px-3 py-2 text-sm">{r.summary}</td>
                    <td className={`${td} break-all`}>{r.requestedByCn}</td>
                    <td className={td}>{r.keyId || "-"}</td>
                    <td className={td}>{r.requiredLevel}</td>
                    <td className={td}>{when(r.createdAt)}</td>
                    <td className={td}>{when(r.expiresAt)}</td>
                    <td className={td}>
                      <span className={statusTone[r.status] ?? "text-muted-foreground"}>
                        {r.status}
                      </span>
                      {r.decidedByCn ? (
                        <span className="block text-[11px] text-muted-foreground">
                          by {r.decidedByCn}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <span className="inline-flex gap-2" title={reason || undefined}>
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
