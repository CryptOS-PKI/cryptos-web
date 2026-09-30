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

import type { ColumnDef } from "@tanstack/react-table";

import { useState } from "react";
import { Link } from "react-router-dom";

import { DataTable } from "@/components/data-table/data-table";
import { useAuth } from "@/context/auth";
import { type EnrollmentAdapter, setEnabled, useAdapters } from "@/lib/adapters";

// ToggleCell owns the per-row pending/error state for the enable/disable write.
// The control is admin-only; a non-admin sees no button. Errors (including a
// server-side permission denial) render inline beside the row, never a popup.
const ToggleCell = ({ adapter, isAdmin }: { adapter: EnrollmentAdapter; isAdmin: boolean }) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!isAdmin) {
    return <span className="font-mono text-[11px] text-muted-foreground">admin only</span>;
  }

  const toggle = async () => {
    setError("");
    setPending(true);
    try {
      const res = await setEnabled(adapter.kind, !adapter.enabled);
      if (!res.ok) setError(res.reason ?? "Could not update the adapter.");
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
        {pending ? "Saving…" : `${adapter.enabled ? "Disable" : "Enable"} ${adapter.kind}`}
      </button>
      {error ? (
        <p className="font-mono text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

const buildColumns = (isAdmin: boolean): ColumnDef<EnrollmentAdapter, unknown>[] => [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <Link className="text-primary hover:underline" to={`/protocols/${row.original.kind}`}>
        {row.original.name}
      </Link>
    ),
    header: "Protocol",
  },
  { accessorKey: "endpoint", header: "Endpoint" },
  { accessorKey: "profile", header: "Profile" },
  {
    accessorFn: (a) => (a.enabled ? "enabled" : "disabled"),
    cell: ({ row }) => (
      <span className={row.original.enabled ? "text-success" : "text-muted-foreground"}>
        {row.original.enabled ? "enabled" : "disabled"}
      </span>
    ),
    header: "Enabled",
    id: "enabled",
  },
  {
    cell: ({ row }) => <ToggleCell adapter={row.original} isAdmin={isAdmin} />,
    enableSorting: false,
    header: "",
    id: "actions",
  },
];

export const ProtocolsPage = () => {
  const adapters = useAdapters();
  const { operator } = useAuth();
  const isAdmin = operator?.level === "admin";

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Enrollment protocols</h1>
        <p className="text-sm text-muted-foreground">
          {adapters.filter((a) => a.enabled).length} of {adapters.length} enabled
        </p>
      </div>

      {/* The previous wording said ACME and EST ship "in a later release".
          Both are shipped and served by the nodes -- RFC 8555 and RFC 7030 --
          so the page was telling operators the protocols they had configured
          did not exist (#84). */}
      <p
        className="max-w-3xl rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground"
        role="note"
      >
        <span className="text-foreground">
          ACME (RFC 8555) and EST (RFC 7030) are served by the nodes themselves
        </span>
        , configured per node under <span className="font-mono">pki.acme</span> and{" "}
        <span className="font-mono">pki.est</span>. This page records the fleet&apos;s intent and
        does not yet reflect what a node is actually serving, so check the node&apos;s own
        configuration to confirm. SCEP and Windows autoenrollment are not implemented yet, and
        enabling them here does nothing.
      </p>

      <DataTable
        columns={buildColumns(isAdmin)}
        data={adapters}
        facets={[{ columnId: "enabled", title: "Enabled" }]}
        initialSort={[{ desc: false, id: "name" }]}
        searchKeys={["name", "endpoint"]}
      />
    </section>
  );
};
