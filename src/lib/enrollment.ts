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

import { useEffect, useSyncExternalStore } from "react";

import { recordAudit } from "@/lib/audit";
import { canIssue, type CertKind } from "@/lib/certs";
import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";
import { type Node, type NodeRole } from "@/lib/mock";
import { addNode, getNodeByCn } from "@/lib/nodes";

import type { EnrollmentRequest as ProtoEnrollmentRequest } from "@/gen/fleet/cryptos/fleet/v1/fleet_pb";

export interface Attestation {
  nodeId: string;
  tpm: string;
}

export interface Csr {
  keyType: string;
  subjectCn: string;
}
export interface EnrollmentDraft {
  address: string;
  attestation: Attestation;
  csr: Csr;
  parentCn: string;
  proposedName: string;
  role: NodeRole;
}
export type EnrollmentKind = "LINK" | "SUBORDINATE";
export interface EnrollmentRequest {
  address: string;
  admittedNodeName?: string;
  attestation: Attestation;
  csr: Csr;
  id: string;
  kind: EnrollmentKind;
  parentCn: string;
  pinnedKeySha256?: string;
  proposedName: string;
  rejectionReason?: string;
  requestedAt: string;
  role: NodeRole;
  status: EnrollmentStatus;
}
export type EnrollmentStatus = "APPROVED" | "PENDING" | "REJECTED";

// LINK approval material, re-supplied at approval time (nothing sensitive is
// persisted between CreateEnrollment and ApproveEnrollment). Required for a
// LINK request's approval; omitted for SUBORDINATE.
export interface LinkApprovalMaterial {
  adminCertPem: string;
  adminKeyPem: string;
  caPem: string;
  nodeEndpoint: string;
}

// The two enrollment shapes CreateEnrollment accepts: LINK carries the node
// connection + trust material, SUBORDINATE carries the child/parent/profile
// for a CSR-ferried provision.
export type EnrollmentCreateDraft =
  | { adminCertPem: string; adminKeyPem: string; caPem: string; kind: "LINK"; nodeEndpoint: string }
  | { childNode: string; kind: "SUBORDINATE"; parentCn: string; profile: string };

// All enrolling nodes are CAs (intermediate or issuing), so the parent must be
// able to issue a subordinate-ca cert. When leaf-node requesters are added
// in a future slice, this helper expands to a role switch.
const requiredKind = (role: NodeRole): CertKind => {
  void role; // reserved for future leaf-requester branch
  return "subordinate-ca";
};

export const canApprove = (req: EnrollmentRequest): { ok: boolean; reason?: string } => {
  const parent = getNodeByCn(req.parentCn);
  if (!parent) return { ok: false, reason: `Parent CA "${req.parentCn}" not found.` };
  if (!canIssue(parent).includes(requiredKind(req.role))) {
    return {
      ok: false,
      reason: `Parent ${parent.name} (${parent.identityState}) cannot issue this node's certificate.`,
    };
  }
  return { ok: true };
};

const daysFromNow = (days: number): string => {
  const base = Date.parse("2026-07-01T00:00:00Z");
  return new Date(base + days * 86_400_000).toISOString();
};

const seed = (): EnrollmentRequest[] => [
  {
    address: "10.20.1.80:8443",
    attestation: { nodeId: "nid-7f3a", tpm: "TPM · sealed" },
    csr: { keyType: "ECDSA P-384", subjectCn: "ACME Issuing CA G4" },
    id: "enr-0001",
    kind: "SUBORDINATE",
    parentCn: "ACME Intermediate CA G1",
    proposedName: "acme-issuing-04",
    requestedAt: daysFromNow(-1),
    role: "issuing",
    status: "PENDING",
  },
  {
    address: "10.20.10.80:8443",
    attestation: { nodeId: "nid-2b9c", tpm: "TPM · sealed" },
    csr: { keyType: "ECDSA P-384", subjectCn: "ACME Intermediate CA R3" },
    id: "enr-0002",
    kind: "SUBORDINATE",
    parentCn: "ACME Root CA R2",
    proposedName: "acme-intermediate-04",
    requestedAt: daysFromNow(-2),
    role: "intermediate",
    status: "PENDING",
  },
  {
    address: "10.20.2.80:8443",
    attestation: { nodeId: "nid-9d11", tpm: "UNAVAILABLE · nodeID" },
    csr: { keyType: "ECDSA P-256", subjectCn: "ACME Issuing CA H3" },
    id: "enr-0003",
    kind: "SUBORDINATE",
    parentCn: "ACME Intermediate CA G2", // REVOKED parent -> cannot approve
    proposedName: "acme-issuing-h03",
    requestedAt: daysFromNow(-3),
    role: "issuing",
    status: "PENDING",
  },
];

let requests: EnrollmentRequest[] = seed();
const listeners = new Set<() => void>();
const emit = (): void => {
  for (const l of listeners) l();
};
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const enrollmentsList = (): EnrollmentRequest[] => requests;
export const getEnrollment = (id: string): EnrollmentRequest | undefined =>
  (fleetMode() === "mock" ? requests : liveRequests).find((r) => r.id === id);

// The live enrollment queue, populated by ListEnrollments over Connect. A
// separate store from the mock queue above: `live`/`live-auth` read this
// array and never touch the mock one, so flipping VITE_FLEET_MODE never
// mixes the two. Mirrors the live-store pattern in lib/nodes.ts.
let liveRequests: EnrollmentRequest[] = [];
const liveListeners = new Set<() => void>();
const emitLive = (): void => {
  for (const l of liveListeners) l();
};
const subscribeLive = (l: () => void): (() => void) => {
  liveListeners.add(l);
  return () => liveListeners.delete(l);
};

const knownRoles = new Set<NodeRole>(["root", "intermediate", "issuing"]);
const knownStatuses = new Set<EnrollmentStatus>(["APPROVED", "PENDING", "REJECTED"]);
const knownKinds = new Set<EnrollmentKind>(["LINK", "SUBORDINATE"]);

// EnrollmentRequest (proto) -> the web EnrollmentRequest shape. The proto
// flattens attestation/CSR detail to display strings for this read-only
// surface, so the nested `Attestation`/`Csr` shapes the web type needs are
// reconstructed from them: attestation_summary becomes the `tpm` display
// string (its role for mock data), attestation_node_id becomes `nodeId`; the
// CSR's key type/subject come across as-is. `kind` defaults to SUBORDINATE
// when empty for back-compat with older/mock data that predates the field.
export const fromProtoRequest = (request: ProtoEnrollmentRequest): EnrollmentRequest => ({
  address: request.address,
  admittedNodeName: request.admittedNodeName || undefined,
  attestation: {
    nodeId: request.attestationNodeId,
    tpm: request.attestationSummary,
  },
  csr: {
    keyType: request.csrKeyType,
    subjectCn: request.csrSubjectCn,
  },
  id: request.id,
  kind: knownKinds.has(request.kind as EnrollmentKind)
    ? (request.kind as EnrollmentKind)
    : "SUBORDINATE",
  parentCn: request.parentCn,
  pinnedKeySha256: request.pinnedKeySha256 || undefined,
  proposedName: request.proposedName,
  rejectionReason: request.rejectionReason || undefined,
  requestedAt: request.requestedAt,
  role: knownRoles.has(request.role as NodeRole) ? (request.role as NodeRole) : "issuing",
  status: knownStatuses.has(request.status as EnrollmentStatus)
    ? (request.status as EnrollmentStatus)
    : "PENDING",
});

const ENROLLMENTS_POLL_INTERVAL_MS = 10_000;

// Fetches ListEnrollments once and (for `live`/`live-auth`) keeps polling on
// an interval so a newly submitted request is picked up without a reload.
// Errors are swallowed to a console warning: a manager outage should degrade
// the enrollment view to whatever it last had, not throw the page into an
// error boundary.
const refreshLiveEnrollments = async (): Promise<void> => {
  try {
    const response = await fleetClient().listEnrollments({});
    liveRequests = response.items.map(fromProtoRequest);
    emitLive();
  } catch (error) {
    // eslint-disable-next-line no-console -- surfaced for local live debugging
    console.warn("fleet: ListEnrollments failed", error);
  }
};

export const useEnrollments = (): EnrollmentRequest[] => {
  const mode = fleetMode();

  useEffect(() => {
    if (mode === "mock") return;
    void refreshLiveEnrollments();
    const interval = setInterval(() => void refreshLiveEnrollments(), ENROLLMENTS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode]);

  return useSyncExternalStore(
    mode === "mock" ? subscribe : subscribeLive,
    () => (mode === "mock" ? requests : liveRequests),
    () => (mode === "mock" ? requests : liveRequests),
  );
};

let nextId = 9000;

// Mock-only create: models the SUBORDINATE CSR-provisioning flow the mock
// fixtures represent. `createEnrollment` (below) dispatches here for
// `fleetMode() === "mock"`.
const mockRequestEnrollment = (draft: EnrollmentDraft): EnrollmentRequest => {
  const req: EnrollmentRequest = {
    ...draft,
    id: `enr-${nextId++}`,
    kind: "SUBORDINATE",
    requestedAt: daysFromNow(0),
    status: "PENDING",
  };
  requests = [req, ...requests];
  emit();
  return req;
};

// Back-compat alias for the pre-live-seam mock API (existing tests/pages).
export const requestEnrollment = mockRequestEnrollment;

const patch = (id: string, next: Partial<EnrollmentRequest>): void => {
  requests = requests.map((r) => (r.id === id ? { ...r, ...next } : r));
  emit();
};

// Mock-only approve: parent signs (capability-checked), the node joins the
// fleet. The AWAITING_CERT -> ESTABLISHED interim is modeled by admitting the
// node already established for the mock happy path.
const mockApproveEnrollment = (id: string): void => {
  const req = getEnrollment(id);
  if (!req || req.status !== "PENDING") return;
  if (!canApprove(req).ok) return;
  const node: Node = {
    address: req.address,
    bootCount: 1,
    cn: req.csr.subjectCn,
    fleetManager: { linked: true, peerCertDays: 0 },
    identityState: "ESTABLISHED",
    issued: 0,
    issuer: req.parentCn,
    name: req.proposedName,
    parentCn: req.parentCn,
    revoked: 0,
    role: req.role,
    tpm: req.attestation.tpm,
    uptime: "0d 00h",
  };
  addNode(node);
  patch(id, { admittedNodeName: node.name, status: "APPROVED" });
  recordAudit({
    kind: "enroll-approved",
    summary: `Approved enrollment ${req.proposedName} under ${req.parentCn}`,
    targetKind: "node",
    targetPath: `/nodes/${req.proposedName}`,
  });
};

const mockRejectEnrollment = (id: string, reason: string): void => {
  const req = getEnrollment(id);
  if (!req || req.status !== "PENDING") return;
  patch(id, { rejectionReason: reason, status: "REJECTED" });
  recordAudit({
    kind: "enroll-rejected",
    summary: `Rejected enrollment ${req.proposedName} (${reason})`,
    targetKind: "enrollment",
  });
};

// Live writes: `mock` mode keeps mutating the in-memory mock store above
// (unchanged behavior); `live`/`live-auth` call the manager's Connect RPCs
// and then re-pull ListEnrollments so the queue reflects the manager's
// resolved state (which may differ from an optimistic local patch, e.g. a
// LINK approval that fails ApplyConfig). Errors propagate to the caller
// (the enrollment page surfaces them) rather than being swallowed here.
export const createEnrollment = async (draft: EnrollmentCreateDraft): Promise<void> => {
  if (fleetMode() === "mock") {
    if (draft.kind !== "SUBORDINATE") {
      // No mock LINK fixture exists; surface it rather than a silent false success.
      throw new Error("LINK enrollment requires live mode (attestation is not mocked)");
    }
    mockRequestEnrollment({
      address: "",
      attestation: { nodeId: "", tpm: "" },
      csr: { keyType: "", subjectCn: "" },
      parentCn: draft.parentCn,
      proposedName: draft.childNode,
      role: "issuing",
    });
    return;
  }
  await fleetClient().createEnrollment(draft);
  await refreshLiveEnrollments();
};

export const approveEnrollment = async (id: string, link?: LinkApprovalMaterial): Promise<void> => {
  if (fleetMode() === "mock") {
    mockApproveEnrollment(id);
    return;
  }
  await fleetClient().approveEnrollment({ id, ...(link ?? {}) });
  await refreshLiveEnrollments();
};

export const rejectEnrollment = async (id: string, reason: string): Promise<void> => {
  if (fleetMode() === "mock") {
    mockRejectEnrollment(id, reason);
    return;
  }
  await fleetClient().rejectEnrollment({ id, reason });
  await refreshLiveEnrollments();
};

// Test-only.
export const __resetEnrollments = (): void => {
  requests = seed();
  nextId = 9000;
  emit();
};
