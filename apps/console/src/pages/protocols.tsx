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

import { Link } from "react-router-dom";

import { DataTable } from "@/components/data-table/data-table";
import { useNodes } from "@/lib/nodes";
import {
  eligibleForProtocols,
  nodeProtocolRows,
  type ProtocolInfo,
  PROTOCOLS,
} from "@/lib/protocols";

// ProtocolSummary is one protocol's row on the list: the catalog entry plus,
// for an implemented protocol, how many eligible nodes actually report it
// running and how many are stuck waiting on a reboot. #84: these numbers come
// from the nodes' own reported status, not a fleet-wide catalog that a toggle
// here used to bind to nothing.
interface ProtocolSummary extends ProtocolInfo {
  eligible: number;
  rebootPending: number;
  running: number;
}

const summarize = (nodes: ReturnType<typeof useNodes>): ProtocolSummary[] =>
  PROTOCOLS.map((info) => {
    const rows = nodeProtocolRows(nodes, info.kind);
    return {
      ...info,
      eligible: nodes.filter((n) => eligibleForProtocols(n)).length,
      rebootPending: rows.filter((r) => r.rebootPending).length,
      running: rows.filter((r) => r.running).length,
    };
  });

const columns: ColumnDef<ProtocolSummary, unknown>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <Link className="text-primary hover:underline" to={`/protocols/${row.original.kind}`}>
        {row.original.name} ({row.original.rfc})
      </Link>
    ),
    header: "Protocol",
  },
  {
    cell: ({ row }) =>
      row.original.implemented ? (
        <span>
          {row.original.running} of {row.original.eligible} eligible nodes
        </span>
      ) : (
        <span className="text-muted-foreground">not wired up</span>
      ),
    header: "Serving",
    id: "serving",
  },
  {
    cell: ({ row }) =>
      row.original.implemented ? (
        <span className={row.original.rebootPending > 0 ? "text-warning" : "text-muted-foreground"}>
          {row.original.rebootPending} reboot pending
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    header: "Reboot",
    id: "reboot",
  },
  {
    accessorFn: (p) => (p.implemented ? "implemented" : "unavailable"),
    cell: ({ row }) => (
      <span className={row.original.implemented ? "text-success" : "text-muted-foreground"}>
        {row.original.implemented ? "implemented" : "unavailable"}
      </span>
    ),
    header: "Status",
    id: "status",
  },
];

export const ProtocolsPage = () => {
  const nodes = useNodes();
  const rows = summarize(nodes);

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Enrollment protocols</h1>
        <p className="text-sm text-muted-foreground">
          What each managed node reports serving, not a fleet-wide setting
        </p>
      </div>

      {/* #84: the old note said ACME and EST ship "in a later release" after
          both had already shipped (RFC 8555 and RFC 7030), which told an
          operator their configured protocols did not exist. This page now
          reads a node's own reported state instead of a local catalog, so the
          note only needs to explain what "eligible" and "wired up" mean. */}
      <p
        className="max-w-3xl rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground"
        role="note"
      >
        <span className="text-foreground">ACME (RFC 8555) and EST (RFC 7030)</span> are served by
        the nodes themselves, under <span className="font-mono">pki.acme</span> and{" "}
        <span className="font-mono">pki.est</span>. Only an ESTABLISHED issuing node is eligible to
        serve either; a switch here takes effect at that node&apos;s next reboot. SCEP and Windows
        autoenrollment are not implemented yet and have no node to reflect, so this page does not
        offer a switch for them.
      </p>

      <DataTable columns={columns} data={rows} initialSort={[{ desc: false, id: "name" }]} />
    </section>
  );
};
