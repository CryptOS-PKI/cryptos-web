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

import { Button, DataTable, type DataTableColumn, EmptyState, Notice } from "@cryptos-pki/ui";
import { useCallback, useEffect, useState } from "react";

import { McpKeyCreateDialog } from "@/components/mcp-key-create-dialog";
import { McpKeyRevokeDialog } from "@/components/mcp-key-revoke-dialog";
import { useAuth } from "@/context/auth";
import { listMcpKeys, type McpKeyRow } from "@/lib/mcp-keys";

const when = (ts: string): string => (ts ? ts.replace("T", " ").slice(0, 16) : "never");

const AGENT_KEYS_DOCS_URL =
  "https://docs.cryptos-pki.com/docs/fleet-manager/web-operators-audit#agent-keys-and-mcp-sign-in";

// AgentKeysPage lists the MCP agent keys bound to operator certificates. Every
// operator manages their own keys; an admin can widen the list to every
// operator's, which the manager enforces as well.
export const AgentKeysPage = () => {
  const { operator } = useAuth();
  const level = operator?.level ?? "viewer";
  const isAdmin = level === "admin";

  const [all, setAll] = useState(false);
  const [rows, setRows] = useState<McpKeyRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<McpKeyRow | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setRows(await listMcpKeys({ all }));
    } catch (error_: unknown) {
      setLoadError(error_ instanceof Error ? error_.message : "Failed to load agent keys");
    }
  }, [all]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableColumn<McpKeyRow>[] = [
    {
      cell: (r) => r.label || r.id,
      className: "font-semibold",
      header: "Label",
      id: "label",
      mobile: "title",
    },
    { cell: (r) => r.clientName || "created here", header: "Client", id: "client" },
    ...(all
      ? [
          {
            cell: (r: McpKeyRow) => r.operatorCn,
            className: "break-all",
            header: "Operator",
            id: "operator",
          } satisfies DataTableColumn<McpKeyRow>,
        ]
      : []),
    { cell: (r) => r.levelCeiling || "none", header: "Ceiling", id: "ceiling" },
    { cell: (r) => when(r.createdAt), header: "Created", id: "created" },
    { cell: (r) => when(r.lastUsedAt), header: "Last used", id: "lastUsed" },
    {
      cell: (r) =>
        r.revoked ? (
          <span className="text-destructive">revoked</span>
        ) : (
          <span className="text-success">active</span>
        ),
      header: "Status",
      id: "status",
    },
    {
      cell: (r) =>
        r.revoked ? null : (
          <button
            className="rounded-md border px-2.5 py-1 text-xs hover:bg-secondary"
            onClick={() => setRevokeTarget(r)}
            type="button"
          >
            {"Revoke…"}
          </button>
        ),
      header: <span className="sr-only">Actions</span>,
      id: "actions",
      mobile: "action",
    },
  ];

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Agent keys</h1>
          <p className="text-sm text-muted-foreground">
            {rows.filter((r) => !r.revoked).length} active of {rows.length} MCP agent keys
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin ? (
            <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <input checked={all} onChange={(e) => setAll(e.target.checked)} type="checkbox" />
              All operators
            </label>
          ) : null}
          <Button onClick={() => setShowCreate(true)} size="sm">
            {"Create key…"}
          </Button>
        </div>
      </div>

      <Notice
        action={
          <a
            className="whitespace-nowrap text-primary underline underline-offset-2"
            href={AGENT_KEYS_DOCS_URL}
            rel="noreferrer"
            target="_blank"
          >
            Learn more
          </a>
        }
        role="note"
        tone="warning"
      >
        An agent key is bound to the operator certificate that created it, and stops working when
        that certificate is revoked or renewed. Revoking a key here takes effect on the agent&apos;s
        next request.
      </Notice>

      {loadError ? (
        <Notice role="alert" tone="danger">
          {loadError}
        </Notice>
      ) : null}

      <DataTable
        columns={columns}
        empty={
          <EmptyState
            body="An MCP client gets a key when you approve its sign-in in this browser. For a client that cannot open the browser sign-in, create one here."
            title="No agent keys yet."
          />
        }
        label="Agent keys"
        rowKey={(r) => r.id}
        rows={rows}
      />

      {showCreate ? (
        <McpKeyCreateDialog
          level={level}
          onClose={() => setShowCreate(false)}
          onCreated={() => void load()}
        />
      ) : null}
      {revokeTarget ? (
        <McpKeyRevokeDialog
          onClose={() => setRevokeTarget(null)}
          onRevoked={() => void load()}
          target={revokeTarget}
        />
      ) : null}
    </section>
  );
};
