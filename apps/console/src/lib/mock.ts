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

// Shared Node/NodeRole/IdentityState shapes for the Fleet Manager UI (used by
// both the mock and the live data source) and a handful of pure helpers
// derived from the mock fixtures. This slice is UI-first: there is no backend
// wiring yet (the api repo only generates Go stubs today, and Connect-Web is
// deferred). The fixtures themselves live behind the `@/lib/mock-fixtures`
// alias (see vite.config.ts) -- mock-fixtures.real.ts for the data,
// mock-fixtures.stub.ts (an empty fleet) for a release build.
//
// The model is a small trust topology: nodes are CAs, and each non-root node
// names its parent by common name (`parentCn`), which the topology view resolves
// into feeder edges. The identity state drives both the node ring color and the
// color of the feeder that flows toward the child.

import { summarize } from "@/lib/fleet/labels";
import { mockNodes } from "@/lib/mock-fixtures";

export type NodeRole = "root" | "intermediate" | "issuing";

export type IdentityState = "ESTABLISHED" | "AWAITING_CERT" | "REVOKED";

// The enrolment protocols a node can report switch state for (ProtocolStatus).
// SCEP and Windows autoenrollment have no Pki block yet (cryptos#185, #108), so
// a node never reports them and they are not part of this union.
export type ProtocolKind = "acme" | "est";

/**
 * A node's reported switch state for one enrolment protocol, mirroring
 * cryptos.node.v1.ProtocolStatus. `configured` and `running` can differ until
 * the node's next boot.
 */
export interface NodeProtocolStatus {
  protocol: ProtocolKind;
  configured: boolean;
  running: boolean;
  rebootPending: boolean;
}

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
  /** Operator-facing node name (also the route param). Renameable (#87). */
  name: string;
  /**
   * Stable fleet inventory identifier (NodeSummary.id): what RenameNode
   * addresses the node by, so the name can change without losing the node.
   * Undefined in the mock fixtures, which stay keyed by name only.
   */
  id?: string;
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
  /**
   * True when the node holds a staged change that only takes effect on
   * reboot (NodeSummary.reboot_required). Undefined in the mock fixtures,
   * which treat it as false.
   */
  rebootRequired?: boolean;
  /**
   * The node's reported enrolment protocol state (NodeSummary.protocols).
   * Undefined for a node that has never reported status, or that only reports
   * protocols this fixture leaves unset.
   */
  protocols?: NodeProtocolStatus[];
  /** Present on root nodes: the FM's dedicated connection context for this root. */
  connection?: RootConnection;
}

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
