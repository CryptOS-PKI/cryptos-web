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

import "reflect-metadata";
import { X509Certificate } from "@peculiar/x509";

import { base64 } from "@/lib/crypto/leaf-key";
import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// Operator credentials. The operator CA is external and the Fleet Manager
// never signs: an admin files a credential request from a CSR, the CA operator
// signs it out of band, and the admin records the signed certificate. Revoking
// puts the credential on the Fleet Manager's own denylist, which doesn't touch
// the CA. A private key made in the browser never reaches this module.

export type OperatorLevel = "admin" | "operator" | "viewer";
export const OPERATOR_LEVELS: OperatorLevel[] = ["viewer", "operator", "admin"];

export const OPERATOR_LEVEL_OID = "1.3.6.1.4.1.59999.1.1";

export interface OperatorCredentialRow {
  commonName: string;
  crlRevoked: boolean;
  denylisted: boolean;
  email: string;
  firstSeenAt: string;
  fullName: string;
  issuerSha256: string;
  // "first_admin", "requested", "recorded", "observed" or "legacy_node".
  kind: string;
  lastSeenAt: string;
  level: string;
  notAfter: string;
  revoked: boolean;
  serialHex: string;
}

export interface CredentialRequestRow {
  completedSerial: string;
  createdAt: string;
  createdByCn: string;
  csrPem: string;
  email: string;
  expiresAt: string;
  fullName: string;
  id: string;
  level: string;
  state: string;
}

export interface CreatedCredentialRequest {
  csrPem: string;
  expiresAt: string;
  extfileSection: string;
  opensslCommand: string;
  requestId: string;
}

export interface RecordedCredential {
  credential: OperatorCredentialRow;
  warnings: string[];
}

export interface DenyResult {
  issuerSha256: string;
  revokedAt: string;
  serialHex: string;
  warnings: string[];
}

// RFC 5280 CRLReason codes offered by the deny dialog. 7 is unassigned.
export const DENY_REASONS: { code: number; label: string }[] = [
  { code: 1, label: "keyCompromise" },
  { code: 3, label: "affiliationChanged" },
  { code: 4, label: "superseded" },
  { code: 5, label: "cessationOfOperation" },
  { code: 9, label: "privilegeWithdrawn" },
  { code: 6, label: "certificateHold" },
  { code: 2, label: "cACompromise" },
  { code: 10, label: "aACompromise" },
  { code: 8, label: "removeFromCRL" },
  { code: 0, label: "unspecified" },
];

export const CA_REVOKE_REMINDER =
  "The Fleet Manager denylist only stops this credential at this Fleet Manager. Also revoke the certificate at your CA and publish a new CRL.";

export const isOperatorLevel = (v: string): v is OperatorLevel =>
  (OPERATOR_LEVELS as string[]).includes(v);

const hexPair = (b: number): string => b.toString(16).padStart(2, "0").toUpperCase();

// levelExtfileSection is the OpenSSL extension section for a level, as the
// manager returns it. Mock mode and the anonymous request page use it; live
// screens show the manager's own copy.
export const levelExtfileSection = (level: OperatorLevel): string => {
  const der = [0x13, level.length, ...new TextEncoder().encode(level)].map(hexPair).join(":");
  return [
    `[ op_${level} ]`,
    "basicConstraints       = critical, CA:FALSE",
    "keyUsage               = critical, digitalSignature",
    "extendedKeyUsage       = clientAuth",
    "subjectKeyIdentifier   = hash",
    "authorityKeyIdentifier = keyid",
    `${OPERATOR_LEVEL_OID}  = DER:${der}`,
  ].join("\n");
};

// credentialFileBase is the file name stem the manager's signing command
// uses: fleetos-<level>-<email>, with anything a shell could read as syntax
// replaced by "_". The CSR download uses it so the command works as given.
export const credentialFileBase = (level: string, email: string): string =>
  `fleetos-${level}-${email.replaceAll(/[^\w.@-]/g, "_")}`;

export const levelOpensslCommand = (level: OperatorLevel, email: string): string => {
  const base = credentialFileBase(level, email);
  return `openssl ca -config operator-ca.cnf -extensions op_${level} -notext -in ${base}.csr -out ${base}.crt`;
};

export const csrToPem = (der: Uint8Array): string => {
  const lines = base64(der).match(/.{1,64}/g) ?? [];
  return `-----BEGIN CERTIFICATE REQUEST-----\n${lines.join("\n")}\n-----END CERTIFICATE REQUEST-----\n`;
};

const blankCredential: OperatorCredentialRow = {
  commonName: "",
  crlRevoked: false,
  denylisted: false,
  email: "",
  firstSeenAt: "",
  fullName: "",
  issuerSha256: "",
  kind: "",
  lastSeenAt: "",
  level: "",
  notAfter: "",
  revoked: false,
  serialHex: "",
};

const toRow = (item: Partial<OperatorCredentialRow>): OperatorCredentialRow => ({
  commonName: item.commonName ?? "",
  crlRevoked: item.crlRevoked ?? false,
  denylisted: item.denylisted ?? false,
  email: item.email ?? "",
  firstSeenAt: item.firstSeenAt ?? "",
  fullName: item.fullName ?? "",
  issuerSha256: item.issuerSha256 ?? "",
  kind: item.kind ?? "",
  lastSeenAt: item.lastSeenAt ?? "",
  level: item.level ?? "",
  notAfter: item.notAfter ?? "",
  revoked: item.revoked ?? false,
  serialHex: item.serialHex ?? "",
});

const toRequestRow = (item: Partial<CredentialRequestRow>): CredentialRequestRow => ({
  completedSerial: item.completedSerial ?? "",
  createdAt: item.createdAt ?? "",
  createdByCn: item.createdByCn ?? "",
  csrPem: item.csrPem ?? "",
  email: item.email ?? "",
  expiresAt: item.expiresAt ?? "",
  fullName: item.fullName ?? "",
  id: item.id ?? "",
  level: item.level ?? "",
  state: item.state ?? "",
});

// The mock set is self-consistent (one of each kind, one denylisted, one
// CRL-revoked, one pending request) and mutated in place so the flows feel
// live without a manager.
const MOCK_ISSUER = "9f".repeat(32);

const seedCredentials = (): OperatorCredentialRow[] => [
  {
    ...blankCredential,
    commonName: "operator@acme.example",
    email: "operator@acme.example",
    firstSeenAt: "2026-09-01T12:00:00Z",
    fullName: "Ada Operator",
    issuerSha256: MOCK_ISSUER,
    kind: "first_admin",
    lastSeenAt: "2026-09-30T09:00:00Z",
    level: "admin",
    notAfter: "2027-09-01T00:00:00Z",
    serialHex: "3A:7F:0C:91:D2:44:8B:1E",
  },
  {
    ...blankCredential,
    commonName: "auditor@acme.example",
    email: "auditor@acme.example",
    fullName: "Grace Auditor",
    issuerSha256: MOCK_ISSUER,
    kind: "requested",
    level: "viewer",
    notAfter: "2027-03-15T00:00:00Z",
    serialHex: "11:22:33:44:55:66",
  },
  {
    ...blankCredential,
    commonName: "ci-bot@acme.example",
    email: "ci-bot@acme.example",
    firstSeenAt: "2026-09-20T08:00:00Z",
    issuerSha256: MOCK_ISSUER,
    kind: "observed",
    lastSeenAt: "2026-09-29T17:30:00Z",
    level: "operator",
    notAfter: "2027-01-10T00:00:00Z",
    serialHex: "7C:01:AA:02",
  },
  {
    ...blankCredential,
    commonName: "former-op@acme.example",
    denylisted: true,
    email: "former-op@acme.example",
    issuerSha256: MOCK_ISSUER,
    kind: "recorded",
    level: "operator",
    notAfter: "2027-02-01T00:00:00Z",
    revoked: true,
    serialHex: "DE:AD:BE:EF:00:01",
  },
  {
    ...blankCredential,
    commonName: "lost-laptop@acme.example",
    crlRevoked: true,
    email: "lost-laptop@acme.example",
    issuerSha256: MOCK_ISSUER,
    kind: "requested",
    level: "operator",
    notAfter: "2027-02-01T00:00:00Z",
    revoked: true,
    serialHex: "0B:AD:F0:0D",
  },
  {
    ...blankCredential,
    commonName: "old-node-issued@acme.example",
    kind: "legacy_node",
    level: "admin",
    notAfter: "2026-12-01T00:00:00Z",
    serialHex: "01:02:03",
  },
];

const seedRequests = (): CredentialRequestRow[] => [
  {
    completedSerial: "",
    createdAt: "2026-09-29T14:00:00Z",
    createdByCn: "operator@acme.example",
    csrPem: csrToPem(new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x07])),
    email: "new-hire@acme.example",
    expiresAt: "2026-10-29T14:00:00Z",
    fullName: "Linus New-Hire",
    id: "3b0f6c1e-0d6a-4d8e-9c55-2f1f0a7e4b21",
    level: "operator",
    state: "pending",
  },
];

let mockCredentials = seedCredentials();
let mockRequests = seedRequests();

const randomHex = (bytes: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), hexPair).join(":");

const plusDays = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");

const mockCertCn = (certDer: Uint8Array): string => {
  try {
    return new X509Certificate(new Uint8Array(certDer)).subjectName.getField("CN")[0] ?? "";
  } catch {
    return "";
  }
};

// listOperatorCredentials returns every credential the manager knows: recorded
// ones and those only observed in use.
export const listOperatorCredentials = async (): Promise<OperatorCredentialRow[]> => {
  if (fleetMode() === "mock") {
    return mockCredentials.map((r) => ({ ...r }));
  }
  const response = await fleetClient().listOperatorCredentials({});
  return response.items.map((item) => toRow(item));
};

// listCredentialRequests returns requests in a state ("pending" by default;
// "" for all).
export const listCredentialRequests = async (
  state = "pending",
): Promise<CredentialRequestRow[]> => {
  if (fleetMode() === "mock") {
    return mockRequests.filter((r) => state === "" || r.state === state).map((r) => ({ ...r }));
  }
  const response = await fleetClient().listOperatorCredentialRequests({ state });
  return response.items.map((item) => toRequestRow(item));
};

// createCredentialRequest files a pending request from a CSR. Only the CSR
// crosses the wire; any key stays with whoever made it.
export const createCredentialRequest = async (params: {
  csrDer: Uint8Array;
  email: string;
  fullName: string;
  level: string;
}): Promise<CreatedCredentialRequest> => {
  const { csrDer, level } = params;
  const email = params.email.trim().toLowerCase();
  const fullName = params.fullName.trim();
  if (!isOperatorLevel(level)) {
    throw new Error(`Unknown access level "${level}". Choose viewer, operator or admin.`);
  }
  if (csrDer.length === 0) {
    throw new Error("A CSR is required to request an operator credential.");
  }

  if (fleetMode() === "mock") {
    const id = crypto.randomUUID();
    const csrPem = csrToPem(csrDer);
    const expiresAt = plusDays(30);
    mockRequests = [
      {
        completedSerial: "",
        createdAt: plusDays(0),
        createdByCn: "operator@acme.example",
        csrPem,
        email,
        expiresAt,
        fullName,
        id,
        level,
        state: "pending",
      },
      ...mockRequests,
    ];
    return {
      csrPem,
      expiresAt,
      extfileSection: levelExtfileSection(level),
      opensslCommand: levelOpensslCommand(level, email),
      requestId: id,
    };
  }

  const response = await fleetClient().createOperatorCredentialRequest({
    csrDer,
    email,
    fullName,
    level,
  });
  return {
    csrPem: response.csrPem,
    expiresAt: response.expiresAt,
    extfileSection: response.extfileSection,
    opensslCommand: response.opensslCommand,
    requestId: response.requestId,
  };
};

export const cancelCredentialRequest = async (requestId: string): Promise<void> => {
  if (fleetMode() === "mock") {
    mockRequests = mockRequests.map((r) =>
      r.id === requestId ? { ...r, csrPem: "", state: "cancelled" } : r,
    );
    return;
  }
  await fleetClient().cancelOperatorCredentialRequest({ requestId });
};

// recordOperatorCredential records a certificate the operator CA signed, with
// the request it answers or, without one, as an out-of-band import.
export const recordOperatorCredential = async (params: {
  certDer: Uint8Array;
  fullName?: string;
  requestId?: string;
}): Promise<RecordedCredential> => {
  const requestId = params.requestId ?? "";
  const fullName = params.fullName?.trim() ?? "";

  if (fleetMode() === "mock") {
    const request = mockRequests.find((r) => r.id === requestId);
    const serialHex = randomHex(8);
    const cn = request?.email ?? mockCertCn(params.certDer);
    const credential: OperatorCredentialRow = {
      ...blankCredential,
      commonName: cn || "recorded@acme.example",
      email: cn || "recorded@acme.example",
      fullName: request?.fullName ?? fullName,
      issuerSha256: MOCK_ISSUER,
      kind: request ? "requested" : "recorded",
      level: request?.level ?? "operator",
      notAfter: plusDays(365),
      serialHex,
    };
    mockCredentials = [...mockCredentials, credential];
    if (request) {
      mockRequests = mockRequests.map((r) =>
        r.id === requestId
          ? { ...r, completedSerial: serialHex, csrPem: "", state: "completed" }
          : r,
      );
    }
    return { credential: { ...credential }, warnings: [] };
  }

  const response = await fleetClient().recordOperatorCredential({
    certDer: params.certDer,
    fullName,
    requestId,
  });
  return { credential: toRow(response.credential ?? {}), warnings: [...response.warnings] };
};

// denyOperatorCredential puts a credential on the Fleet Manager denylist. It
// never revokes at the CA; the result carries the reminder to do that too.
export const denyOperatorCredential = async (params: {
  issuerSha256?: string;
  note: string;
  reasonCode: number;
  serialHex: string;
}): Promise<DenyResult> => {
  const issuerSha256 = params.issuerSha256 ?? "";
  if (fleetMode() === "mock") {
    mockCredentials = mockCredentials.map((r) =>
      r.serialHex === params.serialHex ? { ...r, denylisted: true, revoked: true } : r,
    );
    return {
      issuerSha256: issuerSha256 || MOCK_ISSUER,
      revokedAt: plusDays(0),
      serialHex: params.serialHex,
      warnings: [CA_REVOKE_REMINDER],
    };
  }
  const response = await fleetClient().revokeOperatorCredential({
    issuerSha256,
    note: params.note,
    reasonCode: params.reasonCode,
    serialHex: params.serialHex,
  });
  return {
    issuerSha256: response.issuerSha256,
    revokedAt: response.revokedAt,
    serialHex: response.serialHex,
    warnings: [...response.warnings],
  };
};

// Test-only: restore the seeded mock sets between tests.
export const __resetOperators = (): void => {
  mockCredentials = seedCredentials();
  mockRequests = seedRequests();
};
