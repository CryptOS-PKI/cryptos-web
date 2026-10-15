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

import { Button, DataTable, type DataTableColumn, inputClasses, Notice } from "@cryptos-pki/ui";
import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import type { IdentityState } from "@/lib/mock";

import { IdentityBadge } from "@/components/identity-badge";
import { useAuth } from "@/context/auth";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { identityStateLabels, roleLabels } from "@/lib/fleet/labels";
import { useNodes } from "@/lib/nodes";
import {
  ineligibleReason,
  type NodeProtocolRow,
  nodeProtocolRows,
  protocolInfo,
  switchNodeProtocol,
} from "@/lib/protocols";

// ToggleCell owns the per-row pending/error state for one node's switch. Only
// an admin sees the control; an ineligible node (role or state) shows why
// instead, never a toggle that looks live but binds to nothing (#84).
const ToggleCell = ({
  isAdmin,
  kind,
  row,
}: {
  isAdmin: boolean;
  kind: "acme" | "est";
  row: NodeProtocolRow;
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!row.eligible) {
    return (
      <span className="font-mono text-[11px] text-muted-foreground">
        {ineligibleReason(row.node)}
      </span>
    );
  }

  if (!isAdmin) {
    return <span className="font-mono text-[11px] text-muted-foreground">admin only</span>;
  }

  const toggle = async () => {
    setError("");
    setPending(true);
    try {
      await switchNodeProtocol(row.node, kind, !row.configured);
    } catch (error_) {
      setError(fleetErrorMessage(error_, "Could not switch the protocol."));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button
        disabled={pending}
        onClick={() => void toggle()}
        size="sm"
        type="button"
        variant="outline"
      >
        {pending ? "Saving…" : `${row.configured ? "Disable" : "Enable"} on ${row.node.name}`}
      </Button>
      {error ? (
        <p className="font-mono text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

// stateCell renders what the node reports for this protocol: running, waiting
// on a reboot (configured differs from running), or not configured. A node
// that cannot serve the protocol at all shows nothing here -- its row already
// explains why in the action column.
const stateCell = (row: NodeProtocolRow) => {
  if (!row.eligible) return <span className="text-muted-foreground">—</span>;
  if (row.rebootPending) {
    return (
      <span className="text-warning">
        {row.configured ? "enabled" : "disabled"}, reboot pending
      </span>
    );
  }
  if (row.running) return <span className="text-success">running</span>;
  return <span className="text-muted-foreground">not configured</span>;
};

type SortId = "identity" | "name" | "role";

export const ProtocolDetailPage = () => {
  const { kind } = useParams<{ kind: string }>();
  const nodes = useNodes();
  const { operator } = useAuth();
  const isAdmin = operator?.level === "admin";
  const info = kind ? protocolInfo(kind) : undefined;

  const [role, setRole] = useState("");
  const [identity, setIdentity] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ desc: boolean; id: SortId } | null>({
    desc: false,
    id: "name",
  });

  const allRows = useMemo(() => (info ? nodeProtocolRows(nodes, info.kind) : []), [info, nodes]);
  const roles = useMemo(
    // eslint-disable-next-line unicorn/no-array-sort
    () => [...new Set(allRows.map((r) => r.node.role))].sort((a, b) => a.localeCompare(b)),
    [allRows],
  );
  const identities = useMemo(
    // eslint-disable-next-line unicorn/no-array-sort
    () => [...new Set(allRows.map((r) => r.node.identityState))].sort((a, b) => a.localeCompare(b)),
    [allRows],
  );

  if (!info) {
    return <Navigate replace to="/protocols" />;
  }

  const filtered = allRows
    .filter((r) => !role || r.node.role === role)
    .filter((r) => !identity || r.node.identityState === identity)
    .filter((r) => !query || r.node.name.toLowerCase().includes(query.toLowerCase()));
  const rows = sort
    ? // eslint-disable-next-line unicorn/no-array-sort -- Array#toSorted needs ES2023 lib
      [...filtered].sort((a, b) => {
        const dir = sort.desc ? -1 : 1;
        if (sort.id === "name") return a.node.name.localeCompare(b.node.name) * dir;
        if (sort.id === "role") return a.node.role.localeCompare(b.node.role) * dir;
        return a.node.identityState.localeCompare(b.node.identityState) * dir;
      })
    : filtered;

  const sortOf = (id: SortId) => (sort?.id === id ? (sort.desc ? "desc" : "asc") : false);
  const toggleSort = (id: SortId) =>
    setSort((previous) => {
      if (!previous || previous.id !== id) return { desc: false, id };
      if (!previous.desc) return { desc: true, id };
      return null;
    });

  const columns: DataTableColumn<NodeProtocolRow>[] = [
    {
      cell: (r) => (
        <Link className="text-primary hover:underline" to={`/nodes/${r.node.name}`}>
          {r.node.name}
        </Link>
      ),
      filter: (
        <input
          aria-label="Filter name"
          className={inputClasses}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter…"
          value={query}
        />
      ),
      header: "Node",
      id: "name",
      mobile: "title",
      onSort: () => toggleSort("name"),
      sort: sortOf("name"),
    },
    {
      cell: (r) => roleLabels[r.node.role],
      filter: (
        <select
          aria-label="Filter Role"
          className={inputClasses}
          onChange={(event) => setRole(event.target.value)}
          value={role}
        >
          <option value="">All</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
      ),
      header: "Role",
      id: "role",
      onSort: () => toggleSort("role"),
      sort: sortOf("role"),
    },
    {
      cell: (r) => <IdentityBadge state={r.node.identityState} />,
      filter: (
        <select
          aria-label="Filter Identity"
          className={inputClasses}
          onChange={(event) => setIdentity(event.target.value)}
          value={identity}
        >
          <option value="">All</option>
          {identities.map((s) => (
            <option key={s} value={s}>
              {identityStateLabels[s as IdentityState]}
            </option>
          ))}
        </select>
      ),
      header: "Identity",
      id: "identity",
      onSort: () => toggleSort("identity"),
      sort: sortOf("identity"),
    },
    { cell: (r) => stateCell(r), header: "Served", id: "served" },
    {
      cell: (r) => <ToggleCell isAdmin={isAdmin} kind={info.kind as "acme" | "est"} row={r} />,
      header: <span className="sr-only">Actions</span>,
      id: "actions",
      mobile: "action",
    },
  ];

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {info.name} ({info.rfc})
        </h1>
        <p className="font-mono text-sm text-muted-foreground">Enrollment protocol</p>
      </div>

      {info.implemented ? (
        <DataTable
          columns={columns}
          filtered={role !== "" || identity !== "" || query !== ""}
          label={`${info.name} nodes`}
          rowKey={(r) => r.node.name}
          rows={rows}
        />
      ) : (
        <Notice className="max-w-md" tone="warning">
          {info.name} is not implemented. No CryptOS node has a config block for it yet, so there is
          nothing here to switch or report.
        </Notice>
      )}

      <Button asChild variant="outline">
        <Link to="/protocols">Back to protocols</Link>
      </Button>
    </section>
  );
};
