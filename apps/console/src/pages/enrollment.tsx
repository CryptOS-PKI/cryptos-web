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
  Badge,
  Button,
  cn,
  DataTable,
  type DataTableColumn,
  Dialog,
  Field,
  inputClasses,
  Notice,
} from "@cryptos-pki/ui";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/context/auth";
import {
  createEnrollment,
  type EnrollmentCreateDraft,
  type EnrollmentKind,
  type EnrollmentRequest,
  type EnrollmentStatus,
  LINK_CA_HINT,
  requestEnrollment,
  useEnrollments,
} from "@/lib/enrollment";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { roleLabels } from "@/lib/fleet/labels";

const STATUS_TONE: Record<EnrollmentStatus, string> = {
  APPROVED: "text-success",
  PENDING: "text-warning",
  REJECTED: "text-destructive",
};

// A deterministic simulated request (varied by the current count, no RNG).
const simulated = (n: number) => ({
  address: `10.20.1.${100 + n}:8443`,
  attestation: { nodeId: `nid-sim${n}`, tpm: "TPM · sealed" },
  csr: { keyType: "ECDSA P-384", subjectCn: `ACME Issuing CA S${n}` },
  parentCn: "ACME Intermediate CA G1",
  proposedName: `acme-issuing-s${n}`,
  role: "issuing" as const,
});

const EMPTY_LINK_DRAFT = { adminCertPem: "", adminKeyPem: "", caPem: "", nodeEndpoint: "" };
const EMPTY_SUBORDINATE_DRAFT = { childNode: "", parentCn: "", profile: "" };

// The create form: choose a kind, then fill that kind's fields. LINK carries
// the node's admin credentials for the manager to pin (TOFU) and drive
// directly; SUBORDINATE carries the child/parent/profile for a CSR-ferried
// provision. Kept as one component (rather than two pages) so switching kind
// mid-form does not lose the operator's place.
const CreateEnrollmentDialog = ({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (draft: EnrollmentCreateDraft) => void;
}) => {
  const [kind, setKind] = useState<EnrollmentKind>("SUBORDINATE");
  const [linkDraft, setLinkDraft] = useState(EMPTY_LINK_DRAFT);
  const [subordinateDraft, setSubordinateDraft] = useState(EMPTY_SUBORDINATE_DRAFT);

  const linkField = (key: keyof typeof linkDraft) => ({
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setLinkDraft((d) => ({ ...d, [key]: e.target.value })),
    value: linkDraft[key],
  });
  const subordinateField = (key: keyof typeof subordinateDraft) => ({
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setSubordinateDraft((d) => ({ ...d, [key]: e.target.value })),
    value: subordinateDraft[key],
  });

  const complete =
    kind === "LINK"
      ? Object.values(linkDraft).every((v) => v.trim().length > 0)
      : Object.values(subordinateDraft).every((v) => v.trim().length > 0);

  const submit = () => {
    if (kind === "LINK") {
      onSubmit({ ...linkDraft, kind: "LINK" });
    } else {
      onSubmit({ ...subordinateDraft, kind: "SUBORDINATE" });
    }
  };

  return (
    <Dialog
      footer={
        <>
          <Button onClick={onCancel} size="sm" variant="outline">
            Cancel
          </Button>
          <Button disabled={!complete} onClick={submit} size="sm">
            Submit
          </Button>
        </>
      }
      onClose={onCancel}
      open
      title="New enrollment"
    >
      <div className="space-y-4">
        <Field label="Kind">
          <select
            className={inputClasses}
            onChange={(e) => setKind(e.target.value as EnrollmentKind)}
            value={kind}
          >
            <option value="SUBORDINATE">Subordinate (CSR)</option>
            <option value="LINK">Link (agentless)</option>
          </select>
        </Field>

        {kind === "LINK" ? (
          <>
            <Field label="Node endpoint">
              <input className={inputClasses} {...linkField("nodeEndpoint")} />
            </Field>
            <Field label="Admin cert (PEM)">
              <textarea className={cn(inputClasses, "h-16")} {...linkField("adminCertPem")} />
            </Field>
            <Field label="Admin key (PEM)">
              <textarea className={cn(inputClasses, "h-16")} {...linkField("adminKeyPem")} />
            </Field>
            <Field help={LINK_CA_HINT} label="CA (PEM)">
              <textarea className={cn(inputClasses, "h-16")} {...linkField("caPem")} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Child node">
              <input className={inputClasses} {...subordinateField("childNode")} />
            </Field>
            <Field label="Parent CN">
              <input className={inputClasses} {...subordinateField("parentCn")} />
            </Field>
            <Field label="Profile">
              <input className={inputClasses} {...subordinateField("profile")} />
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
};

type SortId = "kind" | "parentCn" | "proposedName" | "requested" | "role" | "status";

export const EnrollmentPage = () => {
  const { operator } = useAuth();
  const requests = useEnrollments();
  const pending = requests.filter((r) => r.status === "PENDING").length;
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ desc: boolean; id: SortId } | null>({
    desc: true,
    id: "requested",
  });

  const canCreate = operator ? operator.level !== "viewer" : false;

  const statuses = useMemo(
    // eslint-disable-next-line unicorn/no-array-sort
    () => [...new Set(requests.map((r) => r.status))].sort((a, b) => a.localeCompare(b)),
    [requests],
  );
  const roles = useMemo(
    // eslint-disable-next-line unicorn/no-array-sort
    () => [...new Set(requests.map((r) => r.role))].sort((a, b) => a.localeCompare(b)),
    [requests],
  );
  const kinds = useMemo(
    // eslint-disable-next-line unicorn/no-array-sort
    () => [...new Set(requests.map((r) => r.kind))].sort((a, b) => a.localeCompare(b)),
    [requests],
  );

  const filtered = requests
    .filter((r) => !status || r.status === status)
    .filter((r) => !role || r.role === role)
    .filter((r) => !kind || r.kind === kind)
    .filter(
      (r) =>
        !query ||
        r.proposedName.toLowerCase().includes(query.toLowerCase()) ||
        r.parentCn.toLowerCase().includes(query.toLowerCase()),
    );
  const rows = sort
    ? // eslint-disable-next-line unicorn/no-array-sort -- Array#toSorted needs ES2023 lib
      [...filtered].sort((a, b) => {
        const dir = sort.desc ? -1 : 1;
        if (sort.id === "requested") return a.requestedAt.localeCompare(b.requestedAt) * dir;
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

  const handleCreate = async (draft: EnrollmentCreateDraft) => {
    setSubmitting(true);
    setError(null);
    try {
      await createEnrollment(draft);
      setCreating(false);
    } catch (error_) {
      setError(fleetErrorMessage(error_, "Create failed."));
    } finally {
      setSubmitting(false);
    }
  };

  const columns: DataTableColumn<EnrollmentRequest>[] = [
    {
      cell: (r) => (
        <Link className="text-primary hover:underline" to={`/enrollment/${r.id}`}>
          {r.proposedName}
        </Link>
      ),
      filter: (
        <input
          aria-label="Filter proposedName"
          className={inputClasses}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter…"
          value={query}
        />
      ),
      header: "Proposed name",
      id: "proposedName",
      mobile: "title",
      onSort: () => toggleSort("proposedName"),
      sort: sortOf("proposedName"),
    },
    {
      cell: (r) => <Badge variant="outline">{r.kind}</Badge>,
      filter: (
        <select
          aria-label="Filter Kind"
          className={inputClasses}
          onChange={(event) => setKind(event.target.value)}
          value={kind}
        >
          <option value="">All</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      ),
      header: "Kind",
      id: "kind",
      onSort: () => toggleSort("kind"),
      sort: sortOf("kind"),
    },
    {
      cell: (r) => roleLabels[r.role],
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
              {roleLabels[r]}
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
      cell: (r) => r.parentCn,
      header: "Parent CA",
      id: "parentCn",
      onSort: () => toggleSort("parentCn"),
      sort: sortOf("parentCn"),
    },
    { cell: (r) => r.requestedAt.slice(0, 10), header: "Requested", id: "requested" },
    {
      cell: (r) => <span className={STATUS_TONE[r.status]}>{r.status}</span>,
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
  ];

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Enrollment</h1>
          <p className="text-sm text-muted-foreground">{pending} pending join requests</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => requestEnrollment(simulated(requests.length + 1))}
            size="sm"
            variant="outline"
          >
            Simulate incoming request
          </Button>
          <Button disabled={!canCreate} onClick={() => setCreating(true)} size="sm">
            New enrollment
          </Button>
        </div>
      </div>

      {canCreate ? null : (
        <p className="font-mono text-xs text-muted-foreground">
          Read-only — your operator level cannot create enrollment requests.
        </p>
      )}
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}

      <DataTable
        columns={columns}
        filtered={status !== "" || role !== "" || kind !== "" || query !== ""}
        label="Enrollment requests"
        rowKey={(r) => r.id}
        rows={rows}
      />

      {creating ? (
        <CreateEnrollmentDialog
          onCancel={() => setCreating(false)}
          onSubmit={(draft) => void handleCreate(draft)}
        />
      ) : null}
      {submitting ? <p className="font-mono text-xs text-muted-foreground">Submitting…</p> : null}
    </section>
  );
};
