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

import {
  Button,
  DataTable,
  type DataTableColumn,
  inputClasses,
  StatusBadge,
} from "@cryptos-pki/ui";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  canIssue,
  type Cert,
  type CertStatus,
  daysUntilExpiry,
  expiryClass,
  renewCert,
  useAllCerts,
} from "@/lib/certs";
import { useNodes } from "@/lib/nodes";

const EXPIRY_TONE: Record<"expired" | "expiring" | "ok", string> = {
  expired: "text-destructive",
  expiring: "text-warning",
  ok: "text-success",
};

// A cert's status badge shows the literal status word, tinted by its raw
// status for a revoked/expired cert, or by how soon it expires for a cert
// that is still VALID -- so a soon-to-expire cert reads as a warning before
// the manager marks it EXPIRED.
const statusVariant = (c: Cert): "expired" | "expiring" | "revoked" | "valid" => {
  if (c.status === "REVOKED") return "revoked";
  if (c.status === "EXPIRED") return "expired";
  return expiryClass(c) === "expiring" ? "expiring" : "valid";
};

const daysLabel = (c: Cert): string => {
  if (c.status === "REVOKED") return "—";
  const d = daysUntilExpiry(c);
  return d < 0 ? `expired ${-d}d ago` : `${d}d`;
};

type SortId = "daysLeft" | "issuerNodeName" | "kind" | "status" | "subjectCn";

export const CertificatesPage = () => {
  const certs = useAllCerts();
  // Issuance happens on a node, so the entry point has to pick one. Listing
  // only nodes that can actually issue avoids sending the operator to a page
  // that immediately redirects them away (#88).
  const issuers = useNodes().filter((n) => canIssue(n).length > 0);
  const [issuer, setIssuer] = useState("");

  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [profile, setProfile] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ desc: boolean; id: SortId } | null>({
    desc: false,
    id: "daysLeft",
  });

  const statuses = useMemo(
    // eslint-disable-next-line unicorn/no-array-sort
    () => [...new Set(certs.map((c) => c.status))].sort((a, b) => a.localeCompare(b)),
    [certs],
  );
  const profiles = useMemo(
    () =>
      [
        // eslint-disable-next-line unicorn/prefer-native-coercion-functions -- Boolean doesn't narrow string | undefined here
        ...new Set(certs.map((c) => c.profile).filter((p): p is string => Boolean(p))),
        // eslint-disable-next-line unicorn/no-array-sort
      ].sort((a, b) => a.localeCompare(b)),
    [certs],
  );

  const filtered = certs
    .filter((c) => !status || c.status === status)
    .filter((c) => !kind || c.kind === kind)
    .filter((c) => !profile || c.profile === profile)
    .filter(
      (c) =>
        !query ||
        c.subjectCn.toLowerCase().includes(query.toLowerCase()) ||
        c.issuerNodeName.toLowerCase().includes(query.toLowerCase()),
    );
  const rows = sort
    ? // eslint-disable-next-line unicorn/no-array-sort -- Array#toSorted needs ES2023 lib
      [...filtered].sort((a, b) => {
        const dir = sort.desc ? -1 : 1;
        if (sort.id === "daysLeft") return (daysUntilExpiry(a) - daysUntilExpiry(b)) * dir;
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

  const columns: DataTableColumn<Cert>[] = [
    {
      cell: (c) => (
        <Link
          className="text-primary hover:underline"
          to={`/nodes/${c.issuerNodeName}/certs/${c.serial}`}
        >
          {c.subjectCn}
        </Link>
      ),
      filter: (
        <input
          aria-label="Filter subjectCn"
          className={inputClasses}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter…"
          value={query}
        />
      ),
      header: "Subject CN",
      id: "subjectCn",
      mobile: "title",
      onSort: () => toggleSort("subjectCn"),
      sort: sortOf("subjectCn"),
    },
    {
      cell: (c) => c.issuerNodeName,
      header: "Issuer node",
      id: "issuerNodeName",
      onSort: () => toggleSort("issuerNodeName"),
      sort: sortOf("issuerNodeName"),
    },
    {
      cell: (c) => (c.kind === "subordinate-ca" ? "sub-CA" : "leaf"),
      filter: (
        <select
          aria-label="Filter Kind"
          className={inputClasses}
          onChange={(event) => setKind(event.target.value)}
          value={kind}
        >
          <option value="">All</option>
          <option value="leaf">leaf</option>
          <option value="subordinate-ca">sub-CA</option>
        </select>
      ),
      header: "Kind",
      id: "kind",
      onSort: () => toggleSort("kind"),
      sort: sortOf("kind"),
    },
    {
      cell: (c) => c.profile ?? "—",
      filter: (
        <select
          aria-label="Filter Profile"
          className={inputClasses}
          onChange={(event) => setProfile(event.target.value)}
          value={profile}
        >
          <option value="">All</option>
          {profiles.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      ),
      header: "Profile",
      id: "profile",
    },
    { cell: (c) => c.notAfter.slice(0, 10), header: "Expires", id: "expires" },
    {
      cell: (c) => (
        <span
          className={c.status === "REVOKED" ? "text-muted-foreground" : EXPIRY_TONE[expiryClass(c)]}
        >
          {daysLabel(c)}
        </span>
      ),
      header: "Days left",
      id: "daysLeft",
      onSort: () => toggleSort("daysLeft"),
      sort: sortOf("daysLeft"),
    },
    {
      cell: (c) => <StatusBadge status={statusVariant(c)}>{c.status}</StatusBadge>,
      filter: (
        <select
          aria-label="Filter Status"
          className={inputClasses}
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          <option value="">All</option>
          {statuses.map((s: CertStatus) => (
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
            className="rounded-md border px-2.5 py-1 text-[11px] hover:bg-secondary"
            onClick={() => renewCert(c.serial)}
            type="button"
          >
            Renew
          </button>
        ),
      header: <span className="sr-only">Actions</span>,
      id: "actions",
      mobile: "action",
    },
  ];

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
              className={inputClasses + " h-9 w-auto"}
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
        columns={columns}
        filtered={status !== "" || kind !== "" || profile !== "" || query !== ""}
        label="Certificates"
        rowKey={(c) => c.serial}
        rows={rows}
      />
    </section>
  );
};
