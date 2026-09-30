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

import { Link } from "react-router-dom";

import type { IdentityState, Node } from "@/lib/mock";

import { DataTable } from "@/components/data-table/data-table";
import { IdentityBadge } from "@/components/identity-badge";
import { certsFor, useAllCerts } from "@/lib/certs";
import { identityStateLabels } from "@/lib/mock";
import { useNodes } from "@/lib/nodes";

const rootColumns: ColumnDef<Node, unknown>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <Link className="text-primary hover:underline" to={`/root/${row.original.name}`}>
        {row.original.name}
      </Link>
    ),
    header: "Name",
  },
  {
    accessorKey: "identityState",
    cell: ({ row }) => <IdentityBadge state={row.original.identityState} />,
    header: "Identity",
  },
  {
    accessorFn: (n) => certsFor(n.name).length,
    enableSorting: true,
    header: "Certs",
    id: "certs",
  },
  { cell: () => "\u203A", enableSorting: false, header: "", id: "chevron" },
];

// The fleet's root CAs. Each root is an independent trust anchor the manager
// reaches over its own mTLS identity; a row opens that root's config + ceremony.
export const RootPage = () => {
  // Subscribe to the certificates: the Certs column reads the module store
  // synchronously, which was empty on a direct load in live mode (#85).
  useAllCerts();
  const roots = useNodes().filter((n) => n.role === "root");

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Root CAs</h1>
        <p className="text-sm text-muted-foreground">{roots.length} root CAs</p>
      </div>

      <DataTable
        columns={rootColumns}
        data={roots}
        facets={[
          {
            columnId: "identityState",
            optionLabel: (value) => identityStateLabels[value as IdentityState],
            title: "Identity",
          },
        ]}
        initialSort={[{ desc: false, id: "name" }]}
        searchKeys={["name"]}
      />
    </section>
  );
};
