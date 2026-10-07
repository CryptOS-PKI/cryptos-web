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

import { recordAudit } from "@/lib/audit";
import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";
import { identityStateLabels, roleLabels } from "@/lib/fleet/labels";
import type { Node, ProtocolKind } from "@/lib/mock";
import { refreshLiveNodes, setMockNodeProtocol } from "@/lib/nodes";

import { ServiceProtocol } from "@cryptos-pki/api-client/cryptos/node/v1/status_pb";

// ProtocolRoute is every protocol the console lists, including the two with no
// node contract yet (#84). It is a superset of ProtocolKind (the mock.ts union
// a node can actually report).
export type ProtocolRoute = ProtocolKind | "ms-autoenroll" | "scep";

// ProtocolInfo is this catalog's one entry per protocol. `serviceProtocol` is
// set only for a protocol a node can report and switch (#84: SCEP and Windows
// autoenrollment have no Pki block yet -- cryptos#185, #108).
export interface ProtocolInfo {
  readonly implemented: boolean;
  readonly kind: ProtocolRoute;
  readonly name: string;
  readonly rfc: string;
  readonly serviceProtocol?: ServiceProtocol;
}

export const PROTOCOLS: ProtocolInfo[] = [
  {
    implemented: true,
    kind: "acme",
    name: "ACME",
    rfc: "RFC 8555",
    serviceProtocol: ServiceProtocol.ACME,
  },
  {
    implemented: true,
    kind: "est",
    name: "EST",
    rfc: "RFC 7030",
    serviceProtocol: ServiceProtocol.EST,
  },
  { implemented: false, kind: "scep", name: "SCEP", rfc: "RFC 8894" },
  {
    implemented: false,
    kind: "ms-autoenroll",
    name: "Windows autoenrollment",
    rfc: "MS-XCEP / MS-WSTEP",
  },
];

export const protocolInfo = (kind: string): ProtocolInfo | undefined =>
  PROTOCOLS.find((p) => p.kind === kind);

// eligibleForProtocols is true only for an ESTABLISHED issuing node: the
// multi-protocol gateway design has issuing nodes serve enrollment, and a node
// that hasn't established its identity has no live config to switch.
export const eligibleForProtocols = (node: Node): boolean =>
  node.role === "issuing" && node.identityState === "ESTABLISHED";

// ineligibleReason names why a node can't serve any protocol, for display
// beside a node row that offers no switch. Undefined for an eligible node.
export const ineligibleReason = (node: Node): string | undefined => {
  if (node.role !== "issuing") return `${roleLabels[node.role]}s don't serve enrollment protocols.`;
  if (node.identityState !== "ESTABLISHED") {
    return `Node is ${identityStateLabels[node.identityState]}, not established.`;
  }
  return undefined;
};

// NodeProtocolRow is one node's eligibility and reported switch state for a
// single implemented protocol, read from the node's own status rather than a
// fleet-wide catalog (#84).
export interface NodeProtocolRow {
  readonly configured: boolean;
  readonly eligible: boolean;
  readonly node: Node;
  readonly rebootPending: boolean;
  readonly running: boolean;
}

// nodeProtocolRows is empty for a protocol with no node contract yet (SCEP,
// Windows autoenrollment): there is nothing truthful to show per node, so the
// page falls back to the "not wired up" note instead of an empty-looking
// table.
export const nodeProtocolRows = (nodes: Node[], kind: ProtocolRoute): NodeProtocolRow[] => {
  const info = protocolInfo(kind);
  if (!info?.implemented) return [];
  return nodes.map((node) => {
    const status = node.protocols?.find((p) => p.protocol === kind);
    return {
      configured: status?.configured ?? false,
      eligible: eligibleForProtocols(node),
      node,
      rebootPending: status?.rebootPending ?? false,
      running: status?.running ?? false,
    };
  });
};

// switchNodeProtocol asks the manager to switch one protocol on one node.
// Mock mode mutates the fixture node's reported status (lib/nodes.ts models
// the same configured-now/running-after-reboot split the real node reports)
// and records an audit entry; live mode calls SetNodeProtocol and refetches
// the fleet so the row reflects the committed state. A live failure (an
// admin gate, a node refusal, an unreachable node) is thrown for the caller
// to render with fleetErrorMessage, the same node-refusal copy the rest of
// the console uses -- never swallowed here.
export const switchNodeProtocol = async (
  node: Node,
  kind: ProtocolKind,
  enabled: boolean,
): Promise<void> => {
  const info = protocolInfo(kind);

  if (fleetMode() === "mock") {
    setMockNodeProtocol(node.name, kind, enabled);
    recordAudit({
      kind: "protocol-toggled",
      summary: `${enabled ? "Enabled" : "Disabled"} ${info?.name ?? kind} on ${node.name}`,
      targetKind: "node",
      targetPath: `/nodes/${node.name}`,
    });
    return;
  }

  await fleetClient().setNodeProtocol({
    enabled,
    nodeName: node.name,
    protocol: info?.serviceProtocol ?? ServiceProtocol.UNSPECIFIED,
  });
  await refreshLiveNodes();
};
