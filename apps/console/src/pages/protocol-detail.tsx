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

import type { ColumnDef } from "@tanstack/react-table";

import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { DataTable } from "@/components/data-table/data-table";
import { IdentityBadge } from "@/components/identity-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { type IdentityState, identityStateLabels, roleLabels } from "@/lib/mock";
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
      <button
        className="rounded-md border px-2.5 py-1 text-xs hover:bg-secondary disabled:opacity-50"
        disabled={pending}
        onClick={() => void toggle()}
        type="button"
      >
        {pending ? "Saving…" : `${row.configured ? "Disable" : "Enable"} on ${row.node.name}`}
      </button>
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

const buildColumns = (
  isAdmin: boolean,
  kind: "acme" | "est",
): ColumnDef<NodeProtocolRow, unknown>[] => [
  {
    accessorFn: (r) => r.node.name,
    cell: ({ row }) => (
      <Link className="text-primary hover:underline" to={`/nodes/${row.original.node.name}`}>
        {row.original.node.name}
      </Link>
    ),
    header: "Node",
    id: "name",
  },
  { accessorFn: (r) => roleLabels[r.node.role], header: "Role", id: "role" },
  {
    accessorFn: (r) => r.node.identityState,
    cell: ({ row }) => <IdentityBadge state={row.original.node.identityState} />,
    header: "Identity",
    id: "identity",
  },
  { cell: ({ row }) => stateCell(row.original), header: "Served", id: "served" },
  {
    cell: ({ row }) => <ToggleCell isAdmin={isAdmin} kind={kind} row={row.original} />,
    enableSorting: false,
    header: "",
    id: "actions",
  },
];

export const ProtocolDetailPage = () => {
  const { kind } = useParams<{ kind: string }>();
  const nodes = useNodes();
  const { operator } = useAuth();
  const isAdmin = operator?.level === "admin";
  const info = kind ? protocolInfo(kind) : undefined;

  if (!info) {
    return <Navigate replace to="/protocols" />;
  }

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
          columns={buildColumns(isAdmin, info.kind as "acme" | "est")}
          data={nodeProtocolRows(nodes, info.kind)}
          facets={[
            { columnId: "role", title: "Role" },
            {
              columnId: "identity",
              optionLabel: (value) => identityStateLabels[value as IdentityState],
              title: "Identity",
            },
          ]}
          initialSort={[{ desc: false, id: "name" }]}
          pageSize={50}
          searchKeys={["name"]}
        />
      ) : (
        <p
          className="max-w-md rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground"
          role="note"
        >
          {info.name} is not implemented. No CryptOS node has a config block for it yet, so there is
          nothing here to switch or report.
        </p>
      )}

      <Button asChild variant="outline">
        <Link to="/protocols">Back to protocols</Link>
      </Button>
    </section>
  );
};
