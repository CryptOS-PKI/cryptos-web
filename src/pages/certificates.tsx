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
import { Button } from "@/components/ui/button";
import {
  canIssue,
  type Cert,
  daysUntilExpiry,
  expiryClass,
  renewCert,
  useAllCerts,
} from "@/lib/certs";
import { useNodes } from "@/lib/nodes";

const TONE: Record<"expired" | "expiring" | "ok", string> = {
  expired: "text-destructive",
  expiring: "text-warning",
  ok: "text-success",
};

const daysLabel = (c: Cert): string => {
  if (c.status === "REVOKED") return "\u2014";
  const d = daysUntilExpiry(c);
  return d < 0 ? `expired ${-d}d ago` : `${d}d`;
};

const certColumns: ColumnDef<Cert, unknown>[] = [
  {
    accessorKey: "subjectCn",
    cell: ({ row }) => (
      <Link
        className="text-primary hover:underline"
        to={`/nodes/${row.original.issuerNodeName}/certs/${row.original.serial}`}
      >
        {row.original.subjectCn}
      </Link>
    ),
    header: "Subject CN",
  },
  { accessorKey: "issuerNodeName", header: "Issuer node" },
  {
    accessorKey: "kind",
    cell: ({ row }) => (row.original.kind === "subordinate-ca" ? "sub-CA" : "leaf"),
    header: "Kind",
  },
  { accessorFn: (c) => c.profile ?? "\u2014", header: "Profile", id: "profile" },
  {
    accessorFn: (c) => c.notAfter.slice(0, 10),
    enableSorting: false,
    header: "Expires",
    id: "expires",
  },
  {
    accessorFn: (c) => daysUntilExpiry(c),
    cell: ({ row }) => (
      <span
        className={
          row.original.status === "REVOKED"
            ? "text-muted-foreground"
            : TONE[expiryClass(row.original)]
        }
      >
        {daysLabel(row.original)}
      </span>
    ),
    header: "Days left",
    id: "daysLeft",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <span
        className={
          row.original.status === "REVOKED"
            ? "text-muted-foreground"
            : TONE[expiryClass(row.original)]
        }
      >
        {row.original.status}
      </span>
    ),
    header: "Status",
  },
  {
    cell: ({ row }) =>
      row.original.status === "REVOKED" ? null : (
        <button
          className="rounded-md border px-2.5 py-1 text-[11px] hover:bg-secondary"
          onClick={() => renewCert(row.original.serial)}
          type="button"
        >
          Renew
        </button>
      ),
    enableSorting: false,
    header: "",
    id: "actions",
  },
];

export const CertificatesPage = () => {
  const certs = useAllCerts();
  // Issuance happens on a node, so the entry point has to pick one. Listing
  // only nodes that can actually issue avoids sending the operator to a page
  // that immediately redirects them away (#88).
  const issuers = useNodes().filter((n) => canIssue(n).length > 0);
  const [issuer, setIssuer] = useState("");

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
          <p className="text-sm text-muted-foreground">
            {certs.length} certificates across the fleet
          </p>
        </div>

        {issuers.length > 0 ? (
          <div className="flex items-center gap-2">
            <select
              aria-label="Issuing node"
              className="h-9 rounded-md border bg-background px-2 font-mono text-xs"
              onChange={(e) => setIssuer(e.target.value)}
              value={issuer}
            >
              <option value="">Select an issuing node</option>
              {issuers.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
            <Button asChild={issuer !== ""} disabled={issuer === ""} size="sm">
              {issuer === "" ? (
                <span>Issue certificate</span>
              ) : (
                <Link to={`/nodes/${issuer}/issue`}>Issue certificate</Link>
              )}
            </Button>
          </div>
        ) : null}
      </div>

      <DataTable
        columns={certColumns}
        data={certs}
        facets={[
          { columnId: "status", title: "Status" },
          {
            columnId: "kind",
            optionLabel: (v) => (v === "subordinate-ca" ? "sub-CA" : "leaf"),
            title: "Kind",
          },
          { columnId: "profile", title: "Profile" },
        ]}
        initialSort={[{ desc: false, id: "daysLeft" }]}
        searchKeys={["subjectCn", "issuerNodeName"]}
      />
    </section>
  );
};
