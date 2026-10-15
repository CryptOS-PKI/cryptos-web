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

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// NodeOutcome mirrors the node's own Outcome enum (audit.proto), stripped of
// its OUTCOME_ prefix by the manager before it reaches the web.
export type NodeOutcome = "DENIED" | "ERROR" | "OK" | "UNSPECIFIED";

// NodeAuditEvent is one entry from a managed node's own hash-chained audit
// log, distinct from the manager's own action log (lib/audit.ts).
export interface NodeAuditEvent {
  actorSubject: string;
  entrySha256Hex: string;
  outcome: NodeOutcome;
  rpcMethod: string;
  seq: number;
  summary: string;
  target: string;
  ts: string;
}

export interface NodeAuditPage {
  entries: NodeAuditEvent[];
  nextPageToken: string;
}

export interface VerifyNodeAuditChainResult {
  entryCount: number;
  firstBrokenSequence: number;
  intact: boolean;
  reason: string;
}

const knownOutcomes = new Set<NodeOutcome>(["DENIED", "ERROR", "OK", "UNSPECIFIED"]);
const asOutcome = (value: string): NodeOutcome =>
  knownOutcomes.has(value as NodeOutcome) ? (value as NodeOutcome) : "UNSPECIFIED";

// A small, deterministic demo log: mock mode has no node to ask, so this
// stands in for ListNodeAuditEvents the way MockConfigDemo stands in for a
// live config read elsewhere in the console.
const mockEvents = (nodeName: string): NodeAuditEvent[] => [
  {
    actorSubject: "CN=operator@acme.example",
    entrySha256Hex: "7c3a9e2f1b6d4850",
    outcome: "OK",
    rpcMethod: "/cryptos.node.v1.NodeService/IssueLeaf",
    seq: 3,
    summary: `Issued a leaf certificate on ${nodeName}`,
    target: "0a1b2c",
    ts: "2026-07-01T00:00:00Z",
  },
  {
    actorSubject: "CN=operator@acme.example",
    entrySha256Hex: "1f4e8a7d2c9b0356",
    outcome: "DENIED",
    rpcMethod: "/cryptos.node.v1.NodeService/RevokeCertificate",
    seq: 2,
    summary: `Refused a revoke on ${nodeName}: viewer level`,
    target: "0a1b2c",
    ts: "2026-06-30T18:00:00Z",
  },
  {
    actorSubject: "CN=bootstrap@acme.example",
    entrySha256Hex: "9d2b5c8e3f1a0724",
    outcome: "OK",
    rpcMethod: "/cryptos.node.v1.NodeService/ApplyConfig",
    seq: 1,
    summary: `Applied the first configuration on ${nodeName}`,
    target: "",
    ts: "2026-06-30T12:00:00Z",
  },
];

// listNodeAuditEvents pages through a managed node's own audit log, oldest
// entry first, through the manager's ListNodeAuditEvents. In mock mode it
// returns a small canned demo log with no next page.
export const listNodeAuditEvents = async (
  nodeName: string,
  opts: { actor?: string; eventType?: string; pageToken?: string } = {},
): Promise<NodeAuditPage> => {
  if (fleetMode() === "mock") {
    return { entries: mockEvents(nodeName), nextPageToken: "" };
  }

  const response = await fleetClient().listNodeAuditEvents({
    actor: opts.actor ?? "",
    eventType: opts.eventType ?? "",
    nodeName,
    pageToken: opts.pageToken ?? "",
  });
  return {
    entries: response.entries.map((e) => ({
      actorSubject: e.actorSubject,
      entrySha256Hex: e.entrySha256Hex,
      outcome: asOutcome(e.outcome),
      rpcMethod: e.rpcMethod,
      seq: Number(e.seq),
      summary: e.summary,
      target: e.target,
      ts: e.ts,
    })),
    nextPageToken: response.nextPageToken,
  };
};

// verifyNodeAuditChain asks a managed node to verify its own stored audit log
// through the manager's VerifyNodeAuditChain. A broken chain is a result, not
// a thrown error. In mock mode it reports the demo log as intact.
export const verifyNodeAuditChain = async (
  nodeName: string,
): Promise<VerifyNodeAuditChainResult> => {
  if (fleetMode() === "mock") {
    return {
      entryCount: mockEvents(nodeName).length,
      firstBrokenSequence: 0,
      intact: true,
      reason: "",
    };
  }

  const response = await fleetClient().verifyNodeAuditChain({ nodeName });
  return {
    entryCount: Number(response.entryCount),
    firstBrokenSequence: Number(response.firstBrokenSequence),
    intact: response.intact,
    reason: response.reason,
  };
};
