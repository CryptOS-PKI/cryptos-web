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

import { DataTable, type DataTableColumn, inputClasses } from "@cryptos-pki/ui";
import { useState } from "react";
import { Link } from "react-router-dom";

import { type AuditEvent, type AuditKind, useAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";

const KIND_TONE: Record<AuditKind, string> = {
  "config-applied": "text-muted-foreground",
  "enroll-approved": "text-success",
  "enroll-rejected": "text-destructive",
  issued: "text-success",
  "mcp-key-created": "text-success",
  "mcp-key-first-used": "text-muted-foreground",
  "mcp-key-rejected": "text-destructive",
  "mcp-key-revoked": "text-destructive",
  "profile-applied": "text-primary",
  "profile-created": "text-muted-foreground",
  "profile-deleted": "text-destructive",
  "profile-updated": "text-muted-foreground",
  "protocol-toggled": "text-muted-foreground",
  rekeyed: "text-primary",
  renewed: "text-primary",
  revoked: "text-destructive",
};

const DASH = "—";

const ACTOR_KIND_LABEL: Record<NonNullable<AuditEvent["actorKind"]>, string> = {
  cert: "certificate",
  mcp_key: "agent key",
};

const OUTCOME_TONE: Record<string, string> = {
  denied: "text-destructive",
  error: "text-destructive",
  ok: "text-success",
  pending: "text-warning",
};

// distinctValues reads option lists for the facet filters from every event,
// not just the ones the other filters currently keep, so narrowing one facet
// never removes the others' options.
const distinctValues = (events: AuditEvent[], pick: (e: AuditEvent) => string | undefined) => {
  const values = new Set<string>();
  for (const e of events) {
    const v = pick(e);
    if (v) values.add(v);
  }
  // eslint-disable-next-line unicorn/no-array-sort -- Array#toSorted needs ES2023 lib
  return [...values].sort((a, b) => a.localeCompare(b));
};

const facetSelect = (
  title: string,
  value: string,
  options: string[],
  onChange: (v: string) => void,
  labelOf: (v: string) => string = (v) => v,
) => (
  <select
    aria-label={`Filter ${title}`}
    className={inputClasses}
    onChange={(e) => onChange(e.target.value)}
    value={value}
  >
    <option value="">All</option>
    {options.map((v) => (
      <option key={v} value={v}>
        {labelOf(v)}
      </option>
    ))}
  </select>
);

export const AuditPage = () => {
  const events = useAudit();

  const [kind, setKind] = useState("");
  const [targetKind, setTargetKind] = useState("");
  const [via, setVia] = useState("");
  const [outcome, setOutcome] = useState("");
  const [query, setQuery] = useState("");

  const filtered = events
    .filter((e) => !kind || e.kind === kind)
    .filter((e) => !targetKind || e.targetKind === targetKind)
    .filter((e) => !via || e.via === via)
    .filter((e) => !outcome || e.outcome === outcome)
    .filter((e) => !query || e.summary.toLowerCase().includes(query.toLowerCase()));

  const columns: DataTableColumn<AuditEvent>[] = [
    { cell: (e) => e.at.slice(0, 10), header: "Time", id: "time" },
    {
      cell: (e) => (
        <span className={cn("font-semibold", KIND_TONE[e.kind])}>
          {e.kind.replaceAll("-", " ")}
        </span>
      ),
      filter: facetSelect(
        "Kind",
        kind,
        distinctValues(events, (e) => e.kind),
        setKind,
        (v) => v.replaceAll("-", " "),
      ),
      header: "Kind",
      id: "kind",
    },
    {
      cell: (e) => e.targetKind ?? DASH,
      filter: facetSelect(
        "Target",
        targetKind,
        distinctValues(events, (e) => e.targetKind),
        setTargetKind,
      ),
      header: "Target",
      id: "targetKind",
    },
    {
      cell: (e) =>
        e.actorCn ? (
          <div className="flex flex-col">
            <span>{e.actorCn}</span>
            {e.actorKind ? (
              <span className="text-[11px] text-muted-foreground">
                {ACTOR_KIND_LABEL[e.actorKind]}
              </span>
            ) : null}
          </div>
        ) : (
          DASH
        ),
      header: "Actor",
      id: "actor",
    },
    {
      cell: (e) => (
        <div className="flex flex-col">
          <span>{e.via ?? DASH}</span>
          {e.tool ? <span className="text-[11px] text-muted-foreground">{e.tool}</span> : null}
        </div>
      ),
      filter: facetSelect(
        "Via",
        via,
        distinctValues(events, (e) => e.via),
        setVia,
      ),
      header: "Via",
      id: "via",
    },
    {
      cell: (e) =>
        e.outcome ? (
          <span className={OUTCOME_TONE[e.outcome] ?? "text-muted-foreground"}>{e.outcome}</span>
        ) : (
          DASH
        ),
      filter: facetSelect(
        "Outcome",
        outcome,
        distinctValues(events, (e) => e.outcome),
        setOutcome,
      ),
      header: "Outcome",
      id: "outcome",
    },
    {
      cell: (e) =>
        e.targetPath ? (
          <Link className="text-primary hover:underline" to={e.targetPath}>
            {e.summary}
          </Link>
        ) : (
          e.summary
        ),
      filter: (
        <input
          aria-label="Filter summary"
          className={inputClasses}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter…"
          value={query}
        />
      ),
      header: "Event",
      id: "summary",
      mobile: "title",
    },
  ];

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-mono text-2xl font-bold tracking-tight">Audit</h1>
        <p className="text-sm text-muted-foreground">{events.length} recorded events</p>
      </div>

      <DataTable
        columns={columns}
        filtered={kind !== "" || targetKind !== "" || via !== "" || outcome !== "" || query !== ""}
        label="Audit"
        rowKey={(e) => e.id}
        rows={filtered}
      />
    </section>
  );
};
