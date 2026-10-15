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
  Dialog,
  Field,
  FieldTile,
  FieldTiles,
  Input,
  inputClasses,
  Notice,
} from "@cryptos-pki/ui";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { useAuth } from "@/context/auth";
import {
  approveEnrollment,
  canApprove,
  type EnrollmentRequest,
  getEnrollment,
  LINK_CA_HINT,
  type LinkApprovalMaterial,
  rejectEnrollment,
  useEnrollments,
} from "@/lib/enrollment";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { roleLabels } from "@/lib/fleet/labels";

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

// The lock tooltip for a role-blocked Approve: a viewer always needs operator
// level; an operator blocked on a LINK request needs admin specifically.
const approveLockReasonFor = (
  allowed: boolean,
  level: "admin" | "operator" | "viewer",
): string | undefined => {
  if (allowed) return undefined;
  if (level === "viewer") return "Needs the operator role";
  return "Needs the admin role for a LINK request";
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
      <FieldTiles columns={2}>
        <FieldTile label="pinned key sha-256" value={req.pinnedKeySha256 ?? "not yet pinned"} />
        <FieldTile
          label="attested"
          value={
            req.pinnedKeySha256 ? (
              <span className="text-success">TOFU-pinned</span>
            ) : (
              <span className="text-warning">awaiting pin</span>
            )
          }
        />
      </FieldTiles>
    ) : (
      <FieldTiles columns={4}>
        <FieldTile label="tpm attestation" value={req.attestation.tpm} />
        <FieldTile label="node id" value={req.attestation.nodeId} />
        <FieldTile label="csr subject cn" value={req.csr.subjectCn} />
        <FieldTile label="key type" value={req.csr.keyType} />
      </FieldTiles>
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
      <Field label="Node endpoint">
        <Input {...field("nodeEndpoint")} />
      </Field>
      <Field label="Admin cert (PEM)">
        <textarea className={cn(inputClasses, "h-20")} {...field("adminCertPem")} />
      </Field>
      <Field label="Admin key (PEM)">
        <textarea className={cn(inputClasses, "h-20")} {...field("adminKeyPem")} />
      </Field>
      <Field help={LINK_CA_HINT} label="CA (PEM)">
        <textarea className={cn(inputClasses, "h-20")} {...field("caPem")} />
      </Field>
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
  const approveLockReason = approveLockReasonFor(allowedByLevel, level);
  const rejectLockReason = level === "viewer" ? "Needs the operator role" : undefined;

  const runApprove = async (link?: LinkApprovalMaterial) => {
    setPending(true);
    setError(null);
    try {
      await approveEnrollment(req.id, link);
      setShowLinkForm(false);
    } catch (error_) {
      setError(fleetErrorMessage(error_, "Approve failed."));
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
        {error ? (
          <Notice role="alert" tone="danger">
            {error}
          </Notice>
        ) : null}
        {showLinkForm ? (
          <LinkMaterialForm
            busy={pending}
            onCancel={() => setShowLinkForm(false)}
            onSubmit={(material) => void runApprove(material)}
          />
        ) : (
          <div className="flex gap-2">
            <Button
              disabled={!approveLockReason && (!canApproveNow || pending)}
              lockedReason={approveLockReason}
              onClick={handleApproveClick}
              size="sm"
            >
              {pending ? "Approving…" : "Approve"}
            </Button>
            <Button
              disabled={!rejectLockReason && pending}
              lockedReason={rejectLockReason}
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

      <FieldTiles columns={4}>
        <FieldTile label="proposed name" value={req.proposedName} />
        <FieldTile label="role" value={roleLabels[req.role]} />
        <FieldTile label="parent ca" value={req.parentCn} />
        <FieldTile label="address" value={req.address} />
        <FieldTile label="requested" value={req.requestedAt.slice(0, 10)} />
        <FieldTile label="status" value={req.status} />
      </FieldTiles>

      <AttestationPanel req={req} />

      {statusBlock}

      <Button asChild variant="outline">
        <Link to="/enrollment">Back to enrollment</Link>
      </Button>

      {rejecting ? (
        <Dialog
          footer={
            <>
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
            </>
          }
          onClose={() => setRejecting(false)}
          open
          title="Reject request"
        >
          <Field label="Reason">
            <Input onChange={(e) => setReason(e.target.value)} value={reason} />
          </Field>
        </Dialog>
      ) : null}
    </section>
  );
};
