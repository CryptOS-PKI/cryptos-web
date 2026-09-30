/*
Apache License 2.0

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
import type { McpKey } from "@/gen/fleet/cryptos/fleet/v1/fleet_pb";

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// MCP agent keys. The manager stores only a hash of each key, so the plaintext
// exists in exactly one place: the CreateMcpKey response, which the create
// dialog shows once and then drops.

export interface McpKeyRow {
  clientName: string;
  createdAt: string;
  id: string;
  label: string;
  lastUsedAt: string;
  levelCeiling: string;
  operatorCn: string;
  operatorSerial: string;
  revoked: boolean;
  revokedAt: string;
}

export interface CreatedMcpKey {
  key: McpKeyRow;
  plaintextKey: string;
}

const LEVELS: OperatorLevel[] = ["viewer", "operator", "admin"];

// ceilingsUpTo lists the ceilings an operator may put on a key: never above
// their own level, because the manager refuses that.
export const ceilingsUpTo = (level: OperatorLevel): OperatorLevel[] =>
  LEVELS.slice(0, LEVELS.indexOf(level) + 1);

const toRow = (k: McpKey): McpKeyRow => ({
  clientName: k.clientName,
  createdAt: k.createdAt,
  id: k.id,
  label: k.label,
  lastUsedAt: k.lastUsedAt,
  levelCeiling: k.levelCeiling,
  operatorCn: k.operatorCn,
  operatorSerial: k.operatorSerial,
  revoked: k.revokedAt !== "",
  revokedAt: k.revokedAt,
});

// The mock caller matches the dev operator the auth context signs in as, so the
// own-keys view and the all-keys view differ the way they do on a real fleet.
const MOCK_SERIAL = "3A:7F:0C:91:D2:44:8B:1E";

const seed = (): McpKeyRow[] => [
  {
    clientName: "Example Agent",
    createdAt: "2026-09-20T14:02:00Z",
    id: "mk-0003",
    label: "workstation agent",
    lastUsedAt: "2026-09-28T09:41:00Z",
    levelCeiling: "operator",
    operatorCn: "operator@example.org",
    operatorSerial: MOCK_SERIAL,
    revoked: false,
    revokedAt: "",
  },
  {
    clientName: "",
    createdAt: "2026-09-18T11:00:00Z",
    id: "mk-0002",
    label: "ci runner",
    lastUsedAt: "2026-09-27T23:10:00Z",
    levelCeiling: "viewer",
    operatorCn: "auditor@example.org",
    operatorSerial: "11:22:33:44:55:66",
    revoked: false,
    revokedAt: "",
  },
  {
    clientName: "Example Agent",
    createdAt: "2026-09-02T08:30:00Z",
    id: "mk-0001",
    label: "old laptop",
    lastUsedAt: "",
    levelCeiling: "admin",
    operatorCn: "operator@example.org",
    operatorSerial: MOCK_SERIAL,
    revoked: true,
    revokedAt: "2026-09-10T16:00:00Z",
  },
];

let mockRows = seed();
let mockNext = 4;

const mockPlaintext = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCodePoint(...bytes));
  return `fos_mcp_${b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
};

// listMcpKeys returns the caller's keys, newest first, revoked ones included.
// `all` widens it to every operator's keys; the manager allows that for admins
// only.
export const listMcpKeys = async ({ all }: { all: boolean }): Promise<McpKeyRow[]> => {
  if (fleetMode() === "mock") {
    return mockRows.filter((r) => all || r.operatorSerial === MOCK_SERIAL).map((r) => ({ ...r }));
  }
  const response = await fleetClient().listMcpKeys({ all });
  return response.items.map(toRow);
};

export const createMcpKey = async ({
  label,
  levelCeiling,
}: {
  label: string;
  levelCeiling: string;
}): Promise<CreatedMcpKey> => {
  if (fleetMode() === "mock") {
    const key: McpKeyRow = {
      clientName: "",
      createdAt: new Date().toISOString(),
      id: `mk-${String(mockNext++).padStart(4, "0")}`,
      label,
      lastUsedAt: "",
      levelCeiling,
      operatorCn: "operator@example.org",
      operatorSerial: MOCK_SERIAL,
      revoked: false,
      revokedAt: "",
    };
    mockRows = [key, ...mockRows];
    return { key: { ...key }, plaintextKey: mockPlaintext() };
  }
  const response = await fleetClient().createMcpKey({ label, levelCeiling });
  if (!response.mcpKey) {
    throw new Error("The manager returned no key metadata.");
  }
  return { key: toRow(response.mcpKey), plaintextKey: response.plaintextKey };
};

export const revokeMcpKey = async (id: string): Promise<void> => {
  if (fleetMode() === "mock") {
    mockRows = mockRows.map((r) =>
      r.id === id && !r.revoked ? { ...r, revoked: true, revokedAt: new Date().toISOString() } : r,
    );
    return;
  }
  await fleetClient().revokeMcpKey({ id });
};

// Test-only: restore the seeded mock set between tests.
export const __resetMcpKeys = (): void => {
  mockRows = seed();
  mockNext = 4;
};
