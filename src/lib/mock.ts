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

// Mock data layer for the Fleet Manager UI. This slice is UI-first: there is no
// backend wiring yet (the api repo only generates Go stubs today, and
// Connect-Web is deferred). These typed fixtures stand in for the manager's
// gRPC responses so the palette, type, and shell render against real shapes.
//
// The model is a small trust topology: nodes are CAs, and each non-root node
// names its parent by common name (`parentCn`), which the topology view resolves
// into feeder edges. The identity state drives both the node ring color and the
// color of the feeder that flows toward the child.

export type NodeRole = "root" | "intermediate" | "issuing";

export type IdentityState = "ESTABLISHED" | "AWAITING_CERT" | "REVOKED";

/** Fleet Manager peer-cert linkage for a node. */
export interface FleetManagerLink {
  /** Whether the node currently holds a valid peer certificate. */
  linked: boolean;
  /** Age of the peer certificate in days; undefined when pulled/unlinked. */
  peerCertDays?: number;
  /** Free-form status for the revoked/unlinked case. */
  note?: string;
}

/** How the Fleet Manager reaches a root CA: a per-root mTLS connection context. */
export interface RootConnection {
  /** mTLS gRPC endpoint the manager dials for this root. */
  endpoint: string;
  /** FM client identity (mTLS) presented to THIS root; distinct per root. */
  mtlsIdentity: string;
}

export interface Node {
  /** Operator-facing node name (also the route param). */
  name: string;
  /** mTLS gRPC address the manager reaches the node on. */
  address: string;
  role: NodeRole;
  identityState: IdentityState;
  /** Subject common name on this CA's own certificate. */
  cn: string;
  /** Common name of the parent CA that signs this node; undefined for the root. */
  parentCn?: string;
  /** Human summary of the issuer, as rendered in the detail panel. */
  issuer: string;
  /** Count of leaf/sub-CA certificates this node has issued. */
  issued: number;
  /** Count of certificates this node has revoked. */
  revoked: number;
  /** TPM / hardware-root attestation summary for the node's key material. */
  tpm: string;
  /** Fleet Manager peer-cert linkage. */
  fleetManager: FleetManagerLink;
  /** Times the node has booted. */
  bootCount: number;
  /** Human-readable uptime since last boot. */
  uptime: string;
  /** CRL distribution point; present only once the CA is established and issuing. */
  crl?: string;
  /** OCSP responder endpoint; present only once the CA is established and issuing. */
  ocsp?: string;
  /** Present on root nodes: the FM's dedicated connection context for this root. */
  connection?: RootConnection;
}

// A fan-out of issuing CAs under a parent intermediate. `prefix` distinguishes
// each branch's node names (e.g. "issuing" -> acme-issuing-01, "issuing-h" ->
// acme-issuing-h01). When `allRevoked` is set the whole branch is REVOKED — a
// revoked parent breaks its children's chains — otherwise the states are seeded
// to exercise the mixed case (one pending, one revoked, the rest established).
const issuingFanOut = (options: {
  allRevoked?: boolean;
  count: number;
  cnPrefix: string;
  namePrefix: string;
  parentCn: string;
  pendingIndex?: number;
  revokedIndex?: number;
  subnet: number;
}): Node[] => {
  const {
    allRevoked = false,
    count,
    cnPrefix,
    namePrefix,
    parentCn,
    pendingIndex = -1,
    revokedIndex = -1,
    subnet,
  } = options;
  return Array.from({ length: count }, (_, i): Node => {
    const n = String(i + 1).padStart(2, "0");
    const pending = !allRevoked && i === pendingIndex;
    const revoked = allRevoked || i === revokedIndex;
    const identityState: IdentityState = pending
      ? "AWAITING_CERT"
      : revoked
        ? "REVOKED"
        : "ESTABLISHED";
    const issued = identityState === "ESTABLISHED" ? 60 + i * 7 : 0;
    return {
      name: `${namePrefix}${n}`,
      address: `10.20.${subnet}.${10 + i}:8443`,
      role: "issuing",
      identityState,
      cn: `${cnPrefix}${n}`,
      parentCn,
      issuer: pending ? `${parentCn} (pending)` : parentCn,
      issued,
      revoked: revoked ? 44 : 0,
      tpm: "UNAVAILABLE · nodeID",
      fleetManager: revoked
        ? { linked: false, note: "peer cert pulled" }
        : { linked: true, peerCertDays: 90 - i },
      bootCount: 1,
      uptime: `${i}d 0${(i % 9) + 1}h`,
      crl:
        identityState === "ESTABLISHED"
          ? `http://pki.acme.example/${namePrefix}${n}/crl`
          : undefined,
      ocsp:
        identityState === "ESTABLISHED"
          ? `http://pki.acme.example/${namePrefix}${n}/ocsp`
          : undefined,
    };
  });
};

export const mockNodes: Node[] = [
  {
    name: "acme-root-01",
    address: "10.20.0.11:8443",
    role: "root",
    identityState: "ESTABLISHED",
    cn: "ACME Root CA G1",
    issuer: "self-signed",
    issued: 2,
    revoked: 0,
    tpm: "TPM · sealed",
    fleetManager: { linked: true, peerCertDays: 88 },
    bootCount: 1,
    uptime: "21d 03h",
    connection: {
      endpoint: "acme-root-01.pki.acme.example:8443",
      mtlsIdentity: "fm-client@acme-root-01",
    },
  },
  {
    name: "acme-intermediate-01",
    address: "10.20.0.21:8443",
    role: "intermediate",
    identityState: "ESTABLISHED",
    cn: "ACME Intermediate CA G1",
    parentCn: "ACME Root CA G1",
    issuer: "ACME Root CA G1",
    issued: 142,
    revoked: 4,
    tpm: "UNAVAILABLE · nodeID",
    fleetManager: { linked: true, peerCertDays: 63 },
    bootCount: 1,
    uptime: "6d 04h",
    crl: "http://pki.acme.example/int-g1/crl",
    ocsp: "http://pki.acme.example/int-g1/ocsp",
  },
  {
    name: "acme-intermediate-02",
    address: "10.20.0.22:8443",
    role: "intermediate",
    identityState: "REVOKED",
    cn: "ACME Intermediate CA G2",
    parentCn: "ACME Root CA G1",
    issuer: "ACME Root CA G1",
    issued: 51,
    revoked: 51,
    tpm: "UNAVAILABLE · nodeID",
    fleetManager: { linked: false, note: "peer cert pulled" },
    bootCount: 2,
    uptime: "12d 09h",
    crl: "http://pki.acme.example/int-g2/crl",
    ocsp: "http://pki.acme.example/int-g2/ocsp",
  },
  ...issuingFanOut({
    count: 3,
    cnPrefix: "ACME Issuing CA G",
    namePrefix: "acme-issuing-",
    parentCn: "ACME Intermediate CA G1",
    pendingIndex: 2,
    subnet: 1,
  }),
  ...issuingFanOut({
    allRevoked: true,
    count: 2,
    cnPrefix: "ACME Issuing CA H",
    namePrefix: "acme-issuing-h",
    parentCn: "ACME Intermediate CA G2",
    subnet: 2,
  }),
  {
    name: "acme-root-02",
    address: "10.20.10.11:8443",
    role: "root",
    identityState: "ESTABLISHED",
    cn: "ACME Root CA R2",
    issuer: "self-signed",
    issued: 1,
    revoked: 0,
    tpm: "TPM · sealed",
    fleetManager: { linked: true, peerCertDays: 40 },
    bootCount: 1,
    uptime: "9d 11h",
    connection: {
      endpoint: "acme-root-02.pki.acme.example:8443",
      mtlsIdentity: "fm-client@acme-root-02",
    },
  },
  {
    name: "acme-intermediate-03",
    address: "10.20.10.21:8443",
    role: "intermediate",
    identityState: "ESTABLISHED",
    cn: "ACME Intermediate CA R2",
    parentCn: "ACME Root CA R2",
    issuer: "ACME Root CA R2",
    issued: 37,
    revoked: 0,
    tpm: "UNAVAILABLE · nodeID",
    fleetManager: { linked: true, peerCertDays: 30 },
    bootCount: 1,
    uptime: "3d 02h",
    crl: "http://pki.acme.example/int-r2/crl",
    ocsp: "http://pki.acme.example/int-r2/ocsp",
  },
  ...issuingFanOut({
    count: 2,
    cnPrefix: "ACME Issuing CA R",
    namePrefix: "acme-issuing-r",
    parentCn: "ACME Intermediate CA R2",
    subnet: 10,
  }),
];

export const roleLabels: Record<NodeRole, string> = {
  root: "Root CA",
  intermediate: "Intermediate CA",
  issuing: "Issuing CA",
};

export const identityStateLabels: Record<IdentityState, string> = {
  ESTABLISHED: "ESTABLISHED",
  AWAITING_CERT: "AWAITING_CERT",
  REVOKED: "REVOKED",
};

/** A resolved trust edge from a parent CA to a child CA. */
export interface TrustEdge {
  parent: Node;
  child: Node;
}

/** Every parent->child trust edge implied by the nodes' `parentCn` links. */
export const trustEdges = (): TrustEdge[] => {
  const edges: TrustEdge[] = [];
  for (const child of mockNodes) {
    if (!child.parentCn) continue;
    const parent = mockNodes.find((n) => n.cn === child.parentCn);
    if (parent) edges.push({ parent, child });
  }
  return edges;
};

/**
 * A parent with more direct children than this renders as a single collapsed
 * group box in the topology instead of individual circles. Fan-outs at or below
 * the threshold still draw as circles.
 */
export const groupThreshold = 5;

/** Direct children of a parent CA, resolved by the children's `parentCn`. */
export const childrenOf = (parentCn: string): Node[] => {
  return mockNodes.filter((node) => node.parentCn === parentCn);
};

/** Per-state member counts for a set of nodes. */
export interface StateSummary {
  established: number;
  pending: number;
  revoked: number;
}

/** Tally a set of nodes by identity state. */
export const summarize = (nodes: Node[]): StateSummary => {
  const summary: StateSummary = { established: 0, pending: 0, revoked: 0 };
  for (const node of nodes) {
    if (node.identityState === "ESTABLISHED") summary.established += 1;
    else if (node.identityState === "AWAITING_CERT") summary.pending += 1;
    else summary.revoked += 1;
  }
  return summary;
};

/**
 * The worst-case identity state across a group, used to color the group's
 * feeder edge: REVOKED if any member is revoked, AWAITING_CERT if any is
 * pending, otherwise ESTABLISHED.
 */
export const aggregateState = (nodes: Node[]): IdentityState => {
  const summary = summarize(nodes);
  if (summary.revoked > 0) return "REVOKED";
  if (summary.pending > 0) return "AWAITING_CERT";
  return "ESTABLISHED";
};
