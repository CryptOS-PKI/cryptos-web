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

import { DataTable, type DataTableColumn, Notice } from "@cryptos-pki/ui";
import { useState } from "react";
import { Link } from "react-router-dom";

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

type SortId = "name" | "status";

export const ProtocolsPage = () => {
  const nodes = useNodes();
  const summary = summarize(nodes);
  const [sort, setSort] = useState<{ desc: boolean; id: SortId } | null>({
    desc: false,
    id: "name",
  });

  const sortOf = (id: SortId) => (sort?.id === id ? (sort.desc ? "desc" : "asc") : false);
  const toggleSort = (id: SortId) =>
    setSort((previous) => {
      if (!previous || previous.id !== id) return { desc: false, id };
      if (!previous.desc) return { desc: true, id };
      return null;
    });

  const rows = sort
    ? // eslint-disable-next-line unicorn/no-array-sort -- Array#toSorted needs ES2023 lib
      [...summary].sort((a, b) => {
        const dir = sort.desc ? -1 : 1;
        if (sort.id === "status")
          return (
            ((a.implemented ? "implemented" : "unavailable") <
            (b.implemented ? "implemented" : "unavailable")
              ? -1
              : 1) * dir
          );
        return a.name.localeCompare(b.name) * dir;
      })
    : summary;

  const columns: DataTableColumn<ProtocolSummary>[] = [
    {
      cell: (p) => (
        <Link className="text-primary hover:underline" to={`/protocols/${p.kind}`}>
          {p.name} ({p.rfc})
        </Link>
      ),
      header: "Protocol",
      id: "name",
      mobile: "title",
      onSort: () => toggleSort("name"),
      sort: sortOf("name"),
    },
    {
      cell: (p) =>
        p.implemented ? (
          <span>
            {p.running} of {p.eligible} eligible nodes
          </span>
        ) : (
          <span className="text-muted-foreground">not wired up</span>
        ),
      header: "Serving",
      id: "serving",
    },
    {
      cell: (p) =>
        p.implemented ? (
          <span className={p.rebootPending > 0 ? "text-warning" : "text-muted-foreground"}>
            {p.rebootPending} reboot pending
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      header: "Reboot",
      id: "reboot",
    },
    {
      cell: (p) => (
        <span className={p.implemented ? "text-success" : "text-muted-foreground"}>
          {p.implemented ? "implemented" : "unavailable"}
        </span>
      ),
      header: "Status",
      id: "status",
      onSort: () => toggleSort("status"),
      sort: sortOf("status"),
    },
  ];

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
      <Notice className="max-w-3xl" tone="warning">
        <span className="text-foreground">ACME (RFC 8555) and EST (RFC 7030)</span> are served by
        the nodes themselves, under <span className="font-mono">pki.acme</span> and{" "}
        <span className="font-mono">pki.est</span>. Only an ESTABLISHED issuing node is eligible to
        serve either; a switch here takes effect at that node&apos;s next reboot. SCEP and Windows
        autoenrollment are not implemented yet and have no node to reflect, so this page does not
        offer a switch for them.
      </Notice>

      <DataTable
        columns={columns}
        label="Enrollment protocols"
        rowKey={(p) => p.kind}
        rows={rows}
      />
    </section>
  );
};
