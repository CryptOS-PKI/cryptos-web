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

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// Operator credential management (S9). The manager routes issuance and
// revocation to the operator-CA node; the web only ever holds the returned
// certificate and the serial. The operator's private key is minted in the
// browser (leaf-key) and never leaves it in plaintext -- the PKCS#12 is
// assembled and sealed client-side (pkcs12) before download.

export type OperatorLevel = "admin" | "operator" | "viewer";
const LEVELS: OperatorLevel[] = ["viewer", "operator", "admin"];

// OperatorCredentialRow is one issued credential as the list surface renders it.
export interface OperatorCredentialRow {
  commonName: string;
  level: string;
  notAfter: string;
  revoked: boolean;
  serialHex: string;
}

// IssuedCredential is what issueOperatorCredential hands back: the signed
// certificate (DER) and its hex serial. The browser assembles the PKCS#12 from
// this cert plus the key it already holds.
export interface IssuedCredential {
  certDer: Uint8Array;
  serialHex: string;
}

const isLevel = (v: string): v is OperatorLevel => (LEVELS as string[]).includes(v);

// A small coherent mock set so the Operators page is exercisable offline. It is
// self-consistent (one revoked, mixed levels) and mutated in place by the mock
// issue/revoke paths so the flow feels live without a manager.
let mockRows: OperatorCredentialRow[] = [
  {
    commonName: "operator@acme.example",
    level: "admin",
    notAfter: "2027-01-01T00:00:00Z",
    revoked: false,
    serialHex: "3A:7F:0C:91:D2:44:8B:1E",
  },
  {
    commonName: "auditor@acme.example",
    level: "viewer",
    notAfter: "2026-11-15T00:00:00Z",
    revoked: false,
    serialHex: "11:22:33:44:55:66",
  },
  {
    commonName: "former-op@acme.example",
    level: "operator",
    notAfter: "2026-09-01T00:00:00Z",
    revoked: true,
    serialHex: "DE:AD:BE:EF:00:01",
  },
];

// listOperatorCredentials returns the issued credentials. `mock` returns the
// in-memory set; live reads through ListOperatorCredentials (operator-readable).
export const listOperatorCredentials = async (): Promise<OperatorCredentialRow[]> => {
  if (fleetMode() === "mock") {
    return mockRows.map((r) => ({ ...r }));
  }
  const response = await fleetClient().listOperatorCredentials({});
  return response.items.map((item) => ({
    commonName: item.commonName,
    level: item.level,
    notAfter: item.notAfter,
    revoked: item.revoked,
    serialHex: item.serialHex,
  }));
};

// issueOperatorCredential validates the level and CSR, then routes the signing
// to the operator-CA node through the manager. In `mock` mode it fabricates a
// plausible cert/serial and appends a row so the page updates; in live mode a
// manager/node error (missing operator-<level> profile, revoked issuer, ...)
// surfaces to the caller with no silent fallback. The CSR bytes and any key
// material are never logged.
export const issueOperatorCredential = async (
  commonName: string,
  level: string,
  csrDer: Uint8Array,
): Promise<IssuedCredential> => {
  if (!isLevel(level)) {
    throw new Error(`Unknown access level "${level}". Choose viewer, operator, or admin.`);
  }
  if (csrDer.length === 0) {
    throw new Error("A generated CSR is required to issue an operator credential.");
  }

  if (fleetMode() === "mock") {
    const serialHex = mockSerial();
    mockRows = [
      ...mockRows,
      {
        commonName,
        level,
        notAfter: "2027-01-01T00:00:00Z",
        revoked: false,
        serialHex,
      },
    ];
    // A short opaque byte string stands in for the signed certificate; the
    // mock flow never needs a parseable cert, only non-empty bytes to pack.
    return { certDer: new TextEncoder().encode(`mock-operator-cert-${serialHex}`), serialHex };
  }

  const response = await fleetClient().issueOperatorCredential({ commonName, csrDer, level });
  return { certDer: response.certDer, serialHex: response.serialHex };
};

// revokeOperatorCredential revokes a credential by serial with an RFC 5280
// reason code. `mock` marks the row revoked; live routes to the operator-CA
// node through the manager and surfaces errors to the caller.
export const revokeOperatorCredential = async (
  serialHex: string,
  reasonCode: number,
): Promise<void> => {
  if (fleetMode() === "mock") {
    mockRows = mockRows.map((r) => (r.serialHex === serialHex ? { ...r, revoked: true } : r));
    return;
  }
  await fleetClient().revokeOperatorCredential({ reasonCode, serialHex });
};

const mockSerial = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(":");
};

// Test-only: restore the seeded mock set between tests.
export const __resetOperators = (): void => {
  mockRows = [
    {
      commonName: "operator@acme.example",
      level: "admin",
      notAfter: "2027-01-01T00:00:00Z",
      revoked: false,
      serialHex: "3A:7F:0C:91:D2:44:8B:1E",
    },
    {
      commonName: "auditor@acme.example",
      level: "viewer",
      notAfter: "2026-11-15T00:00:00Z",
      revoked: false,
      serialHex: "11:22:33:44:55:66",
    },
    {
      commonName: "former-op@acme.example",
      level: "operator",
      notAfter: "2026-09-01T00:00:00Z",
      revoked: true,
      serialHex: "DE:AD:BE:EF:00:01",
    },
  ];
};
