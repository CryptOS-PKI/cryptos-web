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

import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { type CertProfile, useProfiles } from "@/lib/profiles";

const profileColumns: ColumnDef<CertProfile, unknown>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <Link className="text-primary hover:underline" to={`/profiles/${row.original.name}`}>
        {row.original.name}
      </Link>
    ),
    header: "Name",
  },
  { accessorKey: "keyAlg", header: "Key alg" },
  {
    accessorFn: (p) => p.validityDays,
    cell: ({ row }) => `${row.original.validityDays}d`,
    header: "Validity",
    id: "validity",
  },
  { accessorFn: (p) => (p.isCA ? "yes" : "no"), header: "CA", id: "ca" },
  {
    accessorFn: (p) => p.extKeyUsage.join(", ") || "\u2014",
    enableSorting: false,
    header: "Ext key usage",
    id: "eku",
  },
];

export const ProfilesPage = () => {
  const profiles = useProfiles();

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Certificate profiles</h1>
          <p className="text-sm text-muted-foreground">{profiles.length} templates</p>
        </div>
        <Button asChild size="sm">
          <Link to="/profiles/new">New profile</Link>
        </Button>
      </div>

      <DataTable
        columns={profileColumns}
        data={profiles}
        facets={[
          { columnId: "keyAlg", title: "Key alg" },
          { columnId: "ca", title: "CA" },
        ]}
        initialSort={[{ desc: false, id: "name" }]}
        searchKeys={["name"]}
      />
    </section>
  );
};
