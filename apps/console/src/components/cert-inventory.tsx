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

import { DataTable, type DataTableColumn, inputClasses, StatusBadge } from "@cryptos-pki/ui";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { RevokeDialog } from "@/components/revoke-dialog";
import { type Cert, type CertStatus, useCerts } from "@/lib/certs";

const STATUS: Record<CertStatus, "expired" | "revoked" | "valid"> = {
  EXPIRED: "expired",
  REVOKED: "revoked",
  VALID: "valid",
};

type SortId = "kind" | "serial" | "status" | "subjectCn";

export const CertInventory = ({ nodeName }: { nodeName: string }) => {
  const certs = useCerts(nodeName);
  const [revoking, setRevoking] = useState<{ serial: string; subjectCn: string } | null>(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ desc: boolean; id: SortId } | null>(null);

  const statuses = useMemo(
    // eslint-disable-next-line unicorn/no-array-sort
    () => [...new Set(certs.map((c) => c.status))].sort((a, b) => a.localeCompare(b)),
    [certs],
  );

  const filtered = status ? certs.filter((c) => c.status === status) : certs;
  const searched = query
    ? filtered.filter(
        (c) =>
          c.subjectCn.toLowerCase().includes(query.toLowerCase()) ||
          c.serial.toLowerCase().includes(query.toLowerCase()),
      )
    : filtered;
  const rows = sort
    ? // eslint-disable-next-line unicorn/no-array-sort -- Array#toSorted needs ES2023 lib
      [...searched].sort((a, b) => a[sort.id].localeCompare(b[sort.id]) * (sort.desc ? -1 : 1))
    : // eslint-disable-next-line unicorn/no-array-sort -- Array#toSorted needs ES2023 lib
      [...searched].sort((a, b) => a.notAfter.localeCompare(b.notAfter));

  const sortOf = (id: SortId) => (sort?.id === id ? (sort.desc ? "desc" : "asc") : false);
  const toggleSort = (id: SortId) =>
    setSort((previous) => {
      if (!previous || previous.id !== id) return { desc: false, id };
      if (!previous.desc) return { desc: true, id };
      return null;
    });

  const columns: DataTableColumn<Cert>[] = [
    {
      cell: (c) => (
        <Link className="text-primary hover:underline" to={`/nodes/${nodeName}/certs/${c.serial}`}>
          {c.serial}
        </Link>
      ),
      header: "Serial",
      id: "serial",
      onSort: () => toggleSort("serial"),
      sort: sortOf("serial"),
    },
    {
      cell: (c) => c.subjectCn,
      filter: (
        <input
          aria-label="Filter certificates"
          className={inputClasses}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter…"
          value={query}
        />
      ),
      header: "Subject CN",
      id: "subjectCn",
      onSort: () => toggleSort("subjectCn"),
      sort: sortOf("subjectCn"),
    },
    {
      cell: (c) => (c.kind === "subordinate-ca" ? "sub-CA" : "leaf"),
      header: "Kind",
      id: "kind",
      onSort: () => toggleSort("kind"),
      sort: sortOf("kind"),
    },
    { cell: (c) => c.notAfter.slice(0, 10), header: "Expires", id: "expires" },
    {
      cell: (c) => <StatusBadge status={STATUS[c.status]}>{c.status}</StatusBadge>,
      filter: (
        <select
          aria-label="Filter Status"
          className={inputClasses}
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          <option value="">All</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ),
      header: "Status",
      id: "status",
      onSort: () => toggleSort("status"),
      sort: sortOf("status"),
    },
    {
      cell: (c) =>
        c.status === "REVOKED" ? null : (
          <button
            className="text-destructive hover:underline"
            onClick={() => setRevoking({ serial: c.serial, subjectCn: c.subjectCn })}
            type="button"
          >
            Revoke
          </button>
        ),
      header: <span className="sr-only">Actions</span>,
      id: "actions",
      mobile: "action",
    },
  ];

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        filtered={status !== "" || query !== ""}
        label="Certificates"
        rowKey={(c) => c.serial}
        rows={rows}
      />
      {revoking ? (
        <RevokeDialog
          onClose={() => setRevoking(null)}
          serial={revoking.serial}
          subjectCn={revoking.subjectCn}
        />
      ) : null}
    </div>
  );
};
