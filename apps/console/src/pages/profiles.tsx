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

import { Button, DataTable, type DataTableColumn, inputClasses } from "@cryptos-pki/ui";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { type CertProfile, useProfiles } from "@/lib/profiles";

type SortId = "ca" | "keyAlg" | "name" | "validity";

export const ProfilesPage = () => {
  const profiles = useProfiles();

  const [keyAlg, setKeyAlg] = useState("");
  const [ca, setCa] = useState("");
  const [sort, setSort] = useState<{ desc: boolean; id: SortId } | null>({
    desc: false,
    id: "name",
  });

  const keyAlgs = useMemo(
    // eslint-disable-next-line unicorn/no-array-sort
    () => [...new Set(profiles.map((p) => p.keyAlg))].sort((a, b) => a.localeCompare(b)),
    [profiles],
  );

  const filtered = profiles
    .filter((p) => !keyAlg || p.keyAlg === keyAlg)
    .filter((p) => !ca || (p.isCA ? "yes" : "no") === ca);
  const rows = sort
    ? // eslint-disable-next-line unicorn/no-array-sort -- Array#toSorted needs ES2023 lib
      [...filtered].sort((a, b) => {
        const dir = sort.desc ? -1 : 1;
        if (sort.id === "validity") return (a.validityDays - b.validityDays) * dir;
        if (sort.id === "ca")
          return ((a.isCA ? "yes" : "no") < (b.isCA ? "yes" : "no") ? -1 : 1) * dir;
        return a[sort.id].localeCompare(b[sort.id]) * dir;
      })
    : filtered;

  const sortOf = (id: SortId) => (sort?.id === id ? (sort.desc ? "desc" : "asc") : false);
  const toggleSort = (id: SortId) =>
    setSort((previous) => {
      if (!previous || previous.id !== id) return { desc: false, id };
      if (!previous.desc) return { desc: true, id };
      return null;
    });

  const columns: DataTableColumn<CertProfile>[] = [
    {
      cell: (p) => (
        <Link className="text-primary hover:underline" to={`/profiles/${p.name}`}>
          {p.name}
        </Link>
      ),
      header: "Name",
      id: "name",
      mobile: "title",
      onSort: () => toggleSort("name"),
      sort: sortOf("name"),
    },
    {
      cell: (p) => p.keyAlg,
      filter: (
        <select
          aria-label="Filter Key alg"
          className={inputClasses}
          onChange={(event) => setKeyAlg(event.target.value)}
          value={keyAlg}
        >
          <option value="">All</option>
          {keyAlgs.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      ),
      header: "Key alg",
      id: "keyAlg",
      onSort: () => toggleSort("keyAlg"),
      sort: sortOf("keyAlg"),
    },
    {
      cell: (p) => `${p.validityDays}d`,
      header: "Validity",
      id: "validity",
      onSort: () => toggleSort("validity"),
      sort: sortOf("validity"),
    },
    {
      cell: (p) => (p.isCA ? "yes" : "no"),
      filter: (
        <select
          aria-label="Filter CA"
          className={inputClasses}
          onChange={(event) => setCa(event.target.value)}
          value={ca}
        >
          <option value="">All</option>
          <option value="yes">yes</option>
          <option value="no">no</option>
        </select>
      ),
      header: "CA",
      id: "ca",
      onSort: () => toggleSort("ca"),
      sort: sortOf("ca"),
    },
    {
      cell: (p) => p.extKeyUsage.join(", ") || "—",
      header: "Ext key usage",
      id: "eku",
    },
  ];

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
        columns={columns}
        filtered={keyAlg !== "" || ca !== ""}
        label="Certificate profiles"
        rowKey={(p) => p.name}
        rows={rows}
      />
    </section>
  );
};
