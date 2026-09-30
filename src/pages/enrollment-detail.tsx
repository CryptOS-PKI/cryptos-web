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

import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import {
  approveEnrollment,
  canApprove,
  type EnrollmentRequest,
  getEnrollment,
  type LinkApprovalMaterial,
  rejectEnrollment,
  useEnrollments,
} from "@/lib/enrollment";
import { roleLabels } from "@/lib/mock";

const Field = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="flex flex-col gap-1 rounded-lg border bg-secondary px-3 py-2.5">
    <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    <span className="break-all font-mono text-xs">{children}</span>
  </div>
);

const EMPTY_LINK_MATERIAL: LinkApprovalMaterial = {
  adminCertPem: "",
  adminKeyPem: "",
  caPem: "",
  nodeEndpoint: "",
};

// The approve gate: a SUBORDINATE request is admitted by the parent CA signing
// a CSR (operator+ may do this), but a LINK request hands the approving
// operator that node's admin credentials over the wire, so only admin may
// approve a LINK. Layered on top of `canApprove`'s capability check.
const levelAllowsApprove = (level: "admin" | "operator" | "viewer", req: EnrollmentRequest) => {
  if (level === "viewer") return false;
  if (req.kind === "LINK") return level === "admin";
  return true;
};

// Attestation panel: SUBORDINATE keeps the existing TPM/CSR display (the CA
// signs a CSR from an attested TPM identity); LINK has neither -- the trust
// anchor is the manager's TOFU-pinned SHA-256 of the node's admin key,
// surfaced here so the approving operator can out-of-band verify it.
const AttestationPanel = ({ req }: { req: EnrollmentRequest }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Attestation
      </h2>
      <Badge variant="outline">{req.kind}</Badge>
    </div>
    {req.kind === "LINK" ? (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="pinned key sha-256">{req.pinnedKeySha256 ?? "not yet pinned"}</Field>
        <Field label="attested">
          {req.pinnedKeySha256 ? (
            <span className="text-success">TOFU-pinned</span>
          ) : (
            <span className="text-warning">awaiting pin</span>
          )}
        </Field>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="tpm attestation">{req.attestation.tpm}</Field>
        <Field label="node id">{req.attestation.nodeId}</Field>
        <Field label="csr subject cn">{req.csr.subjectCn}</Field>
        <Field label="key type">{req.csr.keyType}</Field>
      </div>
    )}
  </div>
);

const LinkMaterialForm = ({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (material: LinkApprovalMaterial) => void;
}) => {
  const [material, setMaterial] = useState<LinkApprovalMaterial>(EMPTY_LINK_MATERIAL);

  const field = (key: keyof LinkApprovalMaterial) => ({
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setMaterial((m) => ({ ...m, [key]: e.target.value })),
    value: material[key],
  });

  const complete = Object.values(material).every((v) => v.trim().length > 0);

  return (
    <div className="space-y-3 rounded-lg border bg-secondary p-4">
      <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Link approval material
      </h3>
      <label className="block space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Node endpoint
        </span>
        <input
          className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...field("nodeEndpoint")}
        />
      </label>
      <label className="block space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Admin cert (PEM)
        </span>
        <textarea
          className="h-20 w-full rounded-md border bg-card px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          {...field("adminCertPem")}
        />
      </label>
      <label className="block space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Admin key (PEM)
        </span>
        <textarea
          className="h-20 w-full rounded-md border bg-card px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          {...field("adminKeyPem")}
        />
      </label>
      <label className="block space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          CA (PEM)
        </span>
        <textarea
          className="h-20 w-full rounded-md border bg-card px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          {...field("caPem")}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button disabled={busy} onClick={onCancel} size="sm" variant="outline">
          Cancel
        </Button>
        <Button disabled={busy || !complete} onClick={() => onSubmit(material)} size="sm">
          {busy ? "Approving…" : "Submit & approve"}
        </Button>
      </div>
    </div>
  );
};

export const EnrollmentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { operator } = useAuth();
  useEnrollments(); // subscribe so approve/reject re-render this page
  const req = id ? getEnrollment(id) : undefined;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  if (!req) {
    return <Navigate replace to="/enrollment" />;
  }

  const level = operator?.level ?? "viewer";
  const approvable = canApprove(req);
  const allowedByLevel = levelAllowsApprove(level, req);
  const canApproveNow = approvable.ok && allowedByLevel;

  const runApprove = async (link?: LinkApprovalMaterial) => {
    setPending(true);
    setError(null);
    try {
      await approveEnrollment(req.id, link);
      setShowLinkForm(false);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Approve failed.");
    } finally {
      setPending(false);
    }
  };

  const handleApproveClick = () => {
    if (req.kind === "LINK") {
      setShowLinkForm(true);
      return;
    }
    void runApprove();
  };

  const handleReject = async () => {
    setPending(true);
    setError(null);
    try {
      await rejectEnrollment(req.id, reason.trim());
      setRejecting(false);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Reject failed.");
    } finally {
      setPending(false);
    }
  };

  let statusBlock: React.ReactNode;
  if (req.status === "PENDING") {
    statusBlock = (
      <div className="space-y-3">
        {approvable.ok ? null : (
          <p className="font-mono text-xs text-destructive">{approvable.reason}</p>
        )}
        {allowedByLevel ? null : (
          <p className="font-mono text-xs text-muted-foreground">
            {level === "viewer"
              ? "Read-only — your operator level cannot approve or reject."
              : "Approving a LINK request requires the admin level."}
          </p>
        )}
        {error ? <p className="font-mono text-xs text-destructive">{error}</p> : null}
        {showLinkForm ? (
          <LinkMaterialForm
            busy={pending}
            onCancel={() => setShowLinkForm(false)}
            onSubmit={(material) => void runApprove(material)}
          />
        ) : (
          <div className="flex gap-2">
            <Button disabled={!canApproveNow || pending} onClick={handleApproveClick} size="sm">
              {pending ? "Approving…" : "Approve"}
            </Button>
            <Button
              disabled={level === "viewer" || pending}
              onClick={() => setRejecting(true)}
              size="sm"
              variant="destructive"
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    );
  } else if (req.status === "APPROVED") {
    statusBlock = (
      <p className="font-mono text-sm">
        Approved. Node{" "}
        <Link className="text-primary hover:underline" to={`/nodes/${req.admittedNodeName}`}>
          {req.admittedNodeName}
        </Link>{" "}
        joined the fleet.
      </p>
    );
  } else {
    statusBlock = (
      <p className="font-mono text-sm text-destructive">Rejected: {req.rejectionReason}</p>
    );
  }

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{req.proposedName}</h1>
        <p className="font-mono text-sm text-muted-foreground">
          {roleLabels[req.role]} &middot; requesting to join under {req.parentCn}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="proposed name">{req.proposedName}</Field>
        <Field label="role">{roleLabels[req.role]}</Field>
        <Field label="parent ca">{req.parentCn}</Field>
        <Field label="address">{req.address}</Field>
        <Field label="requested">{req.requestedAt.slice(0, 10)}</Field>
        <Field label="status">{req.status}</Field>
      </div>

      <AttestationPanel req={req} />

      {statusBlock}

      <Button asChild variant="outline">
        <Link to="/enrollment">Back to enrollment</Link>
      </Button>

      {rejecting ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRejecting(false)}
          role="presentation"
        >
          <div
            aria-labelledby="reject-title"
            aria-modal="true"
            className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <h2 className="text-lg font-bold" id="reject-title">
              Reject request
            </h2>
            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Reason
              </span>
              <input
                className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                onChange={(e) => setReason(e.target.value)}
                value={reason}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                disabled={pending}
                onClick={() => setRejecting(false)}
                size="sm"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={!reason.trim() || pending}
                onClick={() => void handleReject()}
                size="sm"
                variant="destructive"
              >
                {pending ? "Rejecting…" : "Confirm reject"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
