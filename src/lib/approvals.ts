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

import type { OperatorLevel } from "@/context/auth";
import type { Approval } from "@/gen/fleet/cryptos/fleet/v1/fleet_pb";

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// Approvals for MCP step-up requests. An agent's step-up tool call leaves a
// pending approval that only a person presenting an operator certificate can
// decide; the agent's bearer key can neither list nor decide one.

export interface ApprovalRow {
  createdAt: string;
  decidedAt: string;
  decidedByCn: string;
  decidedBySerial: string;
  expiresAt: string;
  id: string;
  keyId: string;
  requestDigest: string;
  requestedByCn: string;
  requestedBySerial: string;
  requiredLevel: string;
  status: string;
  summary: string;
  tool: string;
}

export type ApprovalStatus = "approved" | "denied" | "expired" | "pending" | "used";

// The nav badge and any open Approvals page listen for this, so a decision
// made in one place recounts everywhere without polling faster.
export const APPROVALS_CHANGED = "cryptos:approvals-changed";

const LEVELS: string[] = ["viewer", "operator", "admin"];

// canDecide mirrors the manager's rule: only a pending approval, and only by
// an operator whose level is at least the one the tool requires.
export const canDecide = (
  level: OperatorLevel,
  approval: Pick<ApprovalRow, "requiredLevel" | "status">,
): boolean => {
  const required = LEVELS.indexOf(approval.requiredLevel);
  return approval.status === "pending" && required >= 0 && LEVELS.indexOf(level) >= required;
};

const toRow = (a: Approval): ApprovalRow => ({
  createdAt: a.createdAt,
  decidedAt: a.decidedAt,
  decidedByCn: a.decidedByCn,
  decidedBySerial: a.decidedBySerial,
  expiresAt: a.expiresAt,
  id: a.id,
  keyId: a.keyId,
  requestDigest: a.requestDigest,
  requestedByCn: a.requestedByCn,
  requestedBySerial: a.requestedBySerial,
  requiredLevel: a.requiredLevel,
  status: a.status,
  summary: a.summary,
  tool: a.tool,
});

const MOCK_SERIAL = "3A:7F:0C:91:D2:44:8B:1E";

const seed = (): ApprovalRow[] => [
  {
    createdAt: "2026-09-28T09:40:00Z",
    decidedAt: "",
    decidedByCn: "",
    decidedBySerial: "",
    expiresAt: "2026-09-28T09:55:00Z",
    id: "ap-0004",
    keyId: "mk-0003",
    requestDigest: "3f6c1a9e0b7d24c58e1f09a6b3d2c47e5a8b0f1d6c3e9a27b4f08d15e6c2a9b3",
    requestedByCn: "operator@example.org",
    requestedBySerial: MOCK_SERIAL,
    requiredLevel: "operator",
    status: "pending",
    summary: "Revoke certificate 4f:2a:91 on issuing-1 (keyCompromise)",
    tool: "cert_revoke",
  },
  {
    createdAt: "2026-09-28T09:12:00Z",
    decidedAt: "",
    decidedByCn: "",
    decidedBySerial: "",
    expiresAt: "2026-09-28T09:27:00Z",
    id: "ap-0003",
    keyId: "mk-0002",
    requestDigest: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
    requestedByCn: "auditor@example.org",
    requestedBySerial: "11:22:33:44:55:66",
    requiredLevel: "admin",
    status: "pending",
    summary: "Decommission node issuing-2",
    tool: "node_decommission",
  },
  {
    createdAt: "2026-09-27T16:05:00Z",
    decidedAt: "2026-09-27T16:07:00Z",
    decidedByCn: "operator@example.org",
    decidedBySerial: MOCK_SERIAL,
    expiresAt: "2026-09-27T16:20:00Z",
    id: "ap-0002",
    keyId: "mk-0003",
    requestDigest: "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0",
    requestedByCn: "operator@example.org",
    requestedBySerial: MOCK_SERIAL,
    requiredLevel: "operator",
    status: "used",
    summary: "Issue a leaf for svc.example.org from a CSR on issuing-1",
    tool: "cert_issue_from_csr",
  },
  {
    createdAt: "2026-09-26T11:00:00Z",
    decidedAt: "",
    decidedByCn: "",
    decidedBySerial: "",
    expiresAt: "2026-09-26T11:15:00Z",
    id: "ap-0001",
    keyId: "mk-0002",
    requestDigest: "9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d",
    requestedByCn: "auditor@example.org",
    requestedBySerial: "11:22:33:44:55:66",
    requiredLevel: "admin",
    status: "expired",
    summary: "Apply config revision 12 to issuing-2",
    tool: "config_apply",
  },
];

let mockRows = seed();

const announce = (): void => {
  globalThis.dispatchEvent(new Event(APPROVALS_CHANGED));
};

// listApprovals returns approvals newest first. An empty status means every
// status.
export const listApprovals = async ({ status }: { status: string }): Promise<ApprovalRow[]> => {
  if (fleetMode() === "mock") {
    return mockRows.filter((r) => status === "" || r.status === status).map((r) => ({ ...r }));
  }
  const response = await fleetClient().listApprovals({ status });
  return response.items.map(toRow);
};

// decideApproval approves or denies one approval and returns it as the manager
// now holds it.
export const decideApproval = async ({
  approve,
  id,
}: {
  approve: boolean;
  id: string;
}): Promise<ApprovalRow> => {
  if (fleetMode() === "mock") {
    const current = mockRows.find((r) => r.id === id);
    if (current?.status !== "pending") {
      throw new Error(`Approval ${id} is not pending.`);
    }
    const decided: ApprovalRow = {
      ...current,
      decidedAt: new Date().toISOString(),
      decidedByCn: "operator@example.org",
      decidedBySerial: MOCK_SERIAL,
      status: approve ? "approved" : "denied",
    };
    mockRows = mockRows.map((r) => (r.id === id ? decided : r));
    announce();
    return { ...decided };
  }
  const response = await fleetClient().decideApproval({ approve, id });
  if (!response.approval) {
    throw new Error("The manager returned no approval.");
  }
  announce();
  return toRow(response.approval);
};

// Test-only: restore the seeded mock set between tests.
export const __resetApprovals = (): void => {
  mockRows = seed();
};
