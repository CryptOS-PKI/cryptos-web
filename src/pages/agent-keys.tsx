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

import { McpKeyCreateDialog } from "@/components/mcp-key-create-dialog";
import { McpKeyRevokeDialog } from "@/components/mcp-key-revoke-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { listMcpKeys, type McpKeyRow } from "@/lib/mcp-keys";

const th =
  "px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground";
const td = "px-3 py-2 font-mono text-xs";

const when = (ts: string): string => (ts ? ts.replace("T", " ").slice(0, 16) : "never");

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

  const columns = all ? 8 : 7;

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

      <p
        className="max-w-3xl rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground"
        role="note"
      >
        An agent key is bound to the operator certificate that created it. It can do no more than
        that certificate&apos;s level or its own ceiling, whichever is lower, and it stops working
        when the certificate is revoked or renewed. Revoking a key here takes effect on the
        agent&apos;s next request.
      </p>

      {loadError ? (
        <p className="font-mono text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="w-full overflow-hidden rounded-xl border bg-card">
        <table className="w-full border-collapse">
          <thead className="border-b bg-secondary/50">
            <tr>
              <th className={th}>Label</th>
              <th className={th}>Client</th>
              {all ? <th className={th}>Operator</th> : null}
              <th className={th}>Ceiling</th>
              <th className={th}>Created</th>
              <th className={th}>Last used</th>
              <th className={th}>Status</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                  colSpan={columns}
                >
                  <p className="text-foreground">No agent keys yet.</p>
                  <p className="mx-auto mt-1 max-w-xl">
                    An MCP client gets a key when you approve its sign-in in this browser. For a
                    client that cannot open the browser sign-in, create one here.
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr className="border-b last:border-0" key={r.id}>
                  <td className={`${td} font-semibold`}>{r.label || r.id}</td>
                  <td className={td}>{r.clientName || "created here"}</td>
                  {all ? <td className={`${td} break-all`}>{r.operatorCn}</td> : null}
                  <td className={td}>{r.levelCeiling || "none"}</td>
                  <td className={td}>{when(r.createdAt)}</td>
                  <td className={td}>{when(r.lastUsedAt)}</td>
                  <td className={td}>
                    {r.revoked ? (
                      <span className="text-destructive">revoked</span>
                    ) : (
                      <span className="text-success">active</span>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    {r.revoked ? null : (
                      <button
                        className="rounded-md border px-2.5 py-1 text-xs hover:bg-secondary"
                        onClick={() => setRevokeTarget(r)}
                        type="button"
                      >
                        {"Revoke…"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
