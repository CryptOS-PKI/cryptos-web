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

import { DataTable, type DataTableColumn, IconChev, inputClasses } from "@cryptos-pki/ui";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { IdentityState, Node, NodeRole } from "@/lib/mock";

import { IdentityBadge } from "@/components/identity-badge";
import { certsFor, useAllCerts } from "@/lib/certs";
import { identityStateLabels, roleLabels } from "@/lib/fleet/labels";
import { useNodes } from "@/lib/nodes";

type SortId = "certs" | "identityState" | "name" | "role";

// Operational nodes only -- the Root CA has its own surface at /root.
export const NodesPage = () => {
  const all = useNodes();
  // Subscribe to the certificates too: the Certs column reads the module
  // store synchronously, which on a direct load of this page in live mode was
  // empty and showed 0 for every node (#85).
  useAllCerts();
  const nodes = all.filter((n) => n.role !== "root");
  const roots = all.length - nodes.length;

  const [role, setRole] = useState("");
  const [identity, setIdentity] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ desc: boolean; id: SortId } | null>({
    desc: false,
    id: "name",
  });

  const roles = [...new Set(nodes.map((n) => n.role))];
  const identities = [...new Set(nodes.map((n) => n.identityState))];

  const filtered = nodes
    .filter((n) => !role || n.role === role)
    .filter((n) => !identity || n.identityState === identity)
    .filter((n) => !query || n.name.toLowerCase().includes(query.toLowerCase()));
  const certsOf = (n: Node) => certsFor(n.name).length;
  const rows = sort
    ? // eslint-disable-next-line unicorn/no-array-sort -- Array#toSorted needs ES2023 lib
      [...filtered].sort((a, b) => {
        const dir = sort.desc ? -1 : 1;
        if (sort.id === "certs") return (certsOf(a) - certsOf(b)) * dir;
        return String(a[sort.id]).localeCompare(String(b[sort.id])) * dir;
      })
    : filtered;

  const sortOf = (id: SortId) => (sort?.id === id ? (sort.desc ? "desc" : "asc") : false);
  const toggleSort = (id: SortId) =>
    setSort((previous) => {
      if (!previous || previous.id !== id) return { desc: false, id };
      if (!previous.desc) return { desc: true, id };
      return null;
    });

  const columns: DataTableColumn<Node>[] = [
    {
      cell: (n) => (
        <Link className="text-primary hover:underline" to={`/nodes/${n.name}`}>
          {n.name}
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
      header: "Name",
      id: "name",
      mobile: "title",
      onSort: () => toggleSort("name"),
      sort: sortOf("name"),
    },
    {
      cell: (n) => roleLabels[n.role],
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
              {roleLabels[r as NodeRole]}
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
      cell: (n) => <IdentityBadge state={n.identityState} />,
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
      id: "identityState",
      onSort: () => toggleSort("identityState"),
      sort: sortOf("identityState"),
    },
    {
      cell: (n) => certsOf(n),
      header: "Certs",
      id: "certs",
      onSort: () => toggleSort("certs"),
      sort: sortOf("certs"),
    },
    {
      cell: () => <IconChev className="size-3.5 text-muted-foreground" />,
      header: <span className="sr-only">Open</span>,
      id: "chevron",
      mobile: "action",
    },
  ];

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
        columns={columns}
        filtered={role !== "" || identity !== "" || query !== ""}
        label="Nodes"
        rowKey={(n) => n.name}
        rows={rows}
      />
    </section>
  );
};
