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
import { identityStateLabels, roleLabels } from "@/lib/mock";
import { useNodes } from "@/lib/nodes";

const nodeColumns: ColumnDef<Node, unknown>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <Link className="text-primary hover:underline" to={`/nodes/${row.original.name}`}>
        {row.original.name}
      </Link>
    ),
    header: "Name",
  },
  { accessorFn: (n) => roleLabels[n.role], header: "Role", id: "role" },
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

// Operational nodes only -- the Root CA has its own surface at /root.
export const NodesPage = () => {
  const all = useNodes();
  // Subscribe to the certificates too: the Certs column reads the module
  // store synchronously, which on a direct load of this page in live mode was
  // empty and showed 0 for every node (#85).
  useAllCerts();
  const nodes = all.filter((n) => n.role !== "root");
  const roots = all.length - nodes.length;

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Nodes</h1>
        <p className="text-sm text-muted-foreground">
          {nodes.length} operational nodes
          {/* Say what is being withheld. Silently omitting roots made a
              two-node fleet look like a one-node fleet (#86). */}
          {roots > 0 ? (
            <>
              {" · "}
              {roots} {roots === 1 ? "root is" : "roots are"} listed under{" "}
              <Link className="text-primary hover:underline" to="/root">
                Root
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <DataTable
        columns={nodeColumns}
        data={nodes}
        facets={[
          { columnId: "role", title: "Role" },
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
