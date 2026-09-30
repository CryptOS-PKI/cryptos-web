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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import {
  createEnrollment,
  type EnrollmentCreateDraft,
  type EnrollmentKind,
  type EnrollmentRequest,
  type EnrollmentStatus,
  requestEnrollment,
  useEnrollments,
} from "@/lib/enrollment";
import { roleLabels } from "@/lib/mock";

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

const enrollmentColumns: ColumnDef<EnrollmentRequest, unknown>[] = [
  {
    accessorKey: "proposedName",
    cell: ({ row }) => (
      <Link className="text-primary hover:underline" to={`/enrollment/${row.original.id}`}>
        {row.original.proposedName}
      </Link>
    ),
    header: "Proposed name",
  },
  {
    accessorKey: "kind",
    cell: ({ row }) => <Badge variant="outline">{row.original.kind}</Badge>,
    header: "Kind",
  },
  { accessorFn: (r) => roleLabels[r.role], header: "Role", id: "role" },
  { accessorKey: "parentCn", header: "Parent CA" },
  {
    accessorFn: (r) => r.requestedAt.slice(0, 10),
    header: "Requested",
    id: "requested",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <span className={STATUS_TONE[row.original.status]}>{row.original.status}</span>
    ),
    header: "Status",
  },
];

const EMPTY_LINK_DRAFT = { adminCertPem: "", adminKeyPem: "", caPem: "", nodeEndpoint: "" };
const EMPTY_SUBORDINATE_DRAFT = { childNode: "", parentCn: "", profile: "" };

// The create form: choose a kind, then fill that kind's fields. LINK carries
// the node's admin credentials for the manager to pin (TOFU) and drive
// directly; SUBORDINATE carries the child/parent/profile for a CSR-ferried
// provision. Kept as one component (rather than two pages) so switching kind
// mid-form does not lose the operator's place.
const CreateEnrollmentForm = ({
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        aria-labelledby="create-enrollment-title"
        aria-modal="true"
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <h2 className="text-lg font-bold" id="create-enrollment-title">
          New enrollment
        </h2>

        <label className="block space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Kind
          </span>
          <select
            className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            onChange={(e) => setKind(e.target.value as EnrollmentKind)}
            value={kind}
          >
            <option value="SUBORDINATE">Subordinate (CSR)</option>
            <option value="LINK">Link (agentless)</option>
          </select>
        </label>

        {kind === "LINK" ? (
          <>
            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Node endpoint
              </span>
              <input
                className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                {...linkField("nodeEndpoint")}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Admin cert (PEM)
              </span>
              <textarea
                className="h-16 w-full rounded-md border bg-card px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                {...linkField("adminCertPem")}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Admin key (PEM)
              </span>
              <textarea
                className="h-16 w-full rounded-md border bg-card px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                {...linkField("adminKeyPem")}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                CA (PEM)
              </span>
              <textarea
                className="h-16 w-full rounded-md border bg-card px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                {...linkField("caPem")}
              />
            </label>
          </>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Child node
              </span>
              <input
                className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                {...subordinateField("childNode")}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Parent CN
              </span>
              <input
                className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                {...subordinateField("parentCn")}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Profile
              </span>
              <input
                className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                {...subordinateField("profile")}
              />
            </label>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} size="sm" variant="outline">
            Cancel
          </Button>
          <Button disabled={!complete} onClick={submit} size="sm">
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
};

export const EnrollmentPage = () => {
  const { operator } = useAuth();
  const requests = useEnrollments();
  const pending = requests.filter((r) => r.status === "PENDING").length;
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const canCreate = operator ? operator.level !== "viewer" : false;

  const handleCreate = async (draft: EnrollmentCreateDraft) => {
    setSubmitting(true);
    setError(null);
    try {
      await createEnrollment(draft);
      setCreating(false);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  };

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
      {error ? <p className="font-mono text-xs text-destructive">{error}</p> : null}

      <DataTable
        columns={enrollmentColumns}
        data={requests}
        facets={[
          { columnId: "status", title: "Status" },
          { columnId: "role", title: "Role" },
          { columnId: "kind", title: "Kind" },
        ]}
        initialSort={[{ desc: true, id: "requested" }]}
        searchKeys={["proposedName", "parentCn"]}
      />

      {creating ? (
        <CreateEnrollmentForm
          onCancel={() => setCreating(false)}
          onSubmit={(draft) => void handleCreate(draft)}
        />
      ) : null}
      {submitting ? <p className="font-mono text-xs text-muted-foreground">Submitting…</p> : null}
    </section>
  );
};
