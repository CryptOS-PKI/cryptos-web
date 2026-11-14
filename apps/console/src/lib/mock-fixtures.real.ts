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

// The real mock fixtures. vite.config.ts's resolve.alias resolves the stable
// `@/lib/mock-fixtures` specifier here only for a mock build
// (VITE_FLEET_MODE=mock) or under Vitest; a release build gets
// mock-fixtures.stub.ts's empty array instead, so this file -- and its data
// -- never reaches that bundle. lib/nodes.ts, lib/certs.ts and lib/mock.ts
// all import from the `@/lib/mock-fixtures` specifier, never from this file
// directly.
import type { EnrollmentAdapter } from "@/lib/adapters";
import type { AuditEvent } from "@/lib/audit";
import type { EnrollmentRequest } from "@/lib/enrollment";
import type { IdentityState, Node, NodeProtocolStatus } from "@/lib/mock";
import type { CertProfile } from "@/lib/profiles";

// A fan-out of issuing CAs under a parent intermediate. `prefix` distinguishes
// each branch's node names (e.g. "issuing" -> acme-issuing-01, "issuing-h" ->
// acme-issuing-h01). When `allRevoked` is set the whole branch is REVOKED — a
// revoked parent breaks its children's chains — otherwise the states are seeded
// to exercise the mixed case (one pending, one revoked, the rest established).
const issuingFanOut = (options: {
  allRevoked?: boolean;
  cnPrefix: string;
  count: number;
  namePrefix: string;
  parentCn: string;
  pendingIndex?: number;
  protocolsByIndex?: Record<number, NodeProtocolStatus[]>;
  revokedIndex?: number;
  subnet: number;
}): Node[] => {
  const {
    allRevoked = false,
    cnPrefix,
    count,
    namePrefix,
    parentCn,
    pendingIndex = -1,
    protocolsByIndex,
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
      address: `10.20.${subnet}.${10 + i}:8443`,
      bootCount: 1,
      cn: `${cnPrefix}${n}`,
      crl:
        identityState === "ESTABLISHED"
          ? `http://pki.acme.example/${namePrefix}${n}/crl`
          : undefined,
      fleetManager: revoked
        ? { linked: false, note: "peer cert pulled" }
        : { linked: true, peerCertDays: 90 - i },
      identityState,
      issued,
      issuer: pending ? `${parentCn} (pending)` : parentCn,
      name: `${namePrefix}${n}`,
      ocsp:
        identityState === "ESTABLISHED"
          ? `http://pki.acme.example/${namePrefix}${n}/ocsp`
          : undefined,
      parentCn,
      protocols: protocolsByIndex?.[i],
      revoked: revoked ? 44 : 0,
      role: "issuing",
      tpm: "UNAVAILABLE · nodeID",
      uptime: `${i}d 0${(i % 9) + 1}h`,
    };
  });
};

export const mockNodes: Node[] = [
  {
    address: "10.20.0.11:8443",
    bootCount: 1,
    cn: "ACME Root CA G1",
    connection: {
      endpoint: "acme-root-01.pki.acme.example:8443",
      mtlsIdentity: "fm-client@acme-root-01",
    },
    fleetManager: { linked: true, peerCertDays: 88 },
    identityState: "ESTABLISHED",
    issued: 2,
    issuer: "self-signed",
    name: "acme-root-01",
    revoked: 0,
    role: "root",
    tpm: "TPM · sealed",
    uptime: "21d 03h",
  },
  {
    address: "10.20.0.21:8443",
    bootCount: 1,
    cn: "ACME Intermediate CA G1",
    crl: "http://pki.acme.example/int-g1/crl",
    fleetManager: { linked: true, peerCertDays: 63 },
    identityState: "ESTABLISHED",
    issued: 142,
    issuer: "ACME Root CA G1",
    name: "acme-intermediate-01",
    ocsp: "http://pki.acme.example/int-g1/ocsp",
    parentCn: "ACME Root CA G1",
    revoked: 4,
    role: "intermediate",
    tpm: "UNAVAILABLE · nodeID",
    uptime: "6d 04h",
  },
  {
    address: "10.20.0.22:8443",
    bootCount: 2,
    cn: "ACME Intermediate CA G2",
    crl: "http://pki.acme.example/int-g2/crl",
    fleetManager: { linked: false, note: "peer cert pulled" },
    identityState: "REVOKED",
    issued: 51,
    issuer: "ACME Root CA G1",
    name: "acme-intermediate-02",
    ocsp: "http://pki.acme.example/int-g2/ocsp",
    parentCn: "ACME Root CA G1",
    revoked: 51,
    role: "intermediate",
    tpm: "UNAVAILABLE · nodeID",
    uptime: "12d 09h",
  },
  ...issuingFanOut({
    cnPrefix: "ACME Issuing CA G",
    count: 3,
    namePrefix: "acme-issuing-",
    parentCn: "ACME Intermediate CA G1",
    pendingIndex: 2,
    // acme-issuing-01 serves both, settled. acme-issuing-02 has EST switched
    // on but not yet running -- it is waiting on a reboot. acme-issuing-03 is
    // AWAITING_CERT (pendingIndex) and reports nothing.
    protocolsByIndex: {
      0: [
        { configured: true, protocol: "acme", rebootPending: false, running: true },
        { configured: true, protocol: "est", rebootPending: false, running: true },
      ],
      1: [
        { configured: true, protocol: "acme", rebootPending: false, running: true },
        { configured: true, protocol: "est", rebootPending: true, running: false },
      ],
    },
    subnet: 1,
  }),
  ...issuingFanOut({
    allRevoked: true,
    cnPrefix: "ACME Issuing CA H",
    count: 2,
    namePrefix: "acme-issuing-h",
    parentCn: "ACME Intermediate CA G2",
    subnet: 2,
  }),
  {
    address: "10.20.10.11:8443",
    bootCount: 1,
    cn: "ACME Root CA R2",
    connection: {
      endpoint: "acme-root-02.pki.acme.example:8443",
      mtlsIdentity: "fm-client@acme-root-02",
    },
    fleetManager: { linked: true, peerCertDays: 40 },
    identityState: "ESTABLISHED",
    issued: 1,
    issuer: "self-signed",
    name: "acme-root-02",
    revoked: 0,
    role: "root",
    tpm: "TPM · sealed",
    uptime: "9d 11h",
  },
  {
    address: "10.20.10.21:8443",
    bootCount: 1,
    cn: "ACME Intermediate CA R2",
    crl: "http://pki.acme.example/int-r2/crl",
    fleetManager: { linked: true, peerCertDays: 30 },
    identityState: "ESTABLISHED",
    issued: 37,
    issuer: "ACME Root CA R2",
    name: "acme-intermediate-03",
    ocsp: "http://pki.acme.example/int-r2/ocsp",
    parentCn: "ACME Root CA R2",
    revoked: 0,
    role: "intermediate",
    tpm: "UNAVAILABLE · nodeID",
    uptime: "3d 02h",
  },
  ...issuingFanOut({
    cnPrefix: "ACME Issuing CA R",
    count: 2,
    namePrefix: "acme-issuing-r",
    parentCn: "ACME Intermediate CA R2",
    subnet: 10,
  }),
] satisfies Node[];

// A tripwire for scripts/check-release-bundle.mjs, not a Node field (so the
// array above needs no `as Node[]` cast to admit it): if this file's real
// array ever reaches a release bundle -- the resolve.alias in
// vite.config.ts is the actual exclusion mechanism, this just proves it --
// the check greps for this literal and fails, naming the file. A plain
// statement, not folded into the mockNodes declaration, so it runs (and
// survives minification) whenever this file is the one resolved, regardless
// of how mockNodes itself ends up used.
export const MOCK_MARKER = "__CRYPTOS_MOCK__";
Object.assign(mockNodes, { __mockMarker: MOCK_MARKER });

// A standalone day-offset helper for the fixtures below, from the same fixed
// epoch as lib/enrollment.ts's and lib/audit.ts's own `daysFromNow` (both keep
// theirs too, for requests/events created at runtime): importing either would
// make this file depend on a value export of a module that imports a value
// (the fixture array) back from here.
const FIXTURE_EPOCH_MS = Date.parse("2026-07-01T00:00:00Z");
const daysFromNow = (days: number): string =>
  new Date(FIXTURE_EPOCH_MS + days * 86_400_000).toISOString();

export const mockEnrollments: EnrollmentRequest[] = [
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

export const MOCK_ENROLLMENT_MARKER = "__CRYPTOS_MOCK_ENROLLMENT__";
Object.assign(mockEnrollments, { __mockMarker: MOCK_ENROLLMENT_MARKER });

export const mockProfiles: CertProfile[] = [
  {
    extKeyUsage: ["server_auth"],
    extraExtensions: [],
    isCA: false,
    keyAlg: "ECDSA-P384",
    keyUsage: ["digital_signature", "key_encipherment"],
    name: "TLS Server (LDAPS)",
    sans: { dns: [], email: [], ip: [], uri: [] },
    subject: { commonName: "", country: "", organization: "" },
    validityDays: 365,
  },
  {
    extKeyUsage: ["client_auth"],
    extraExtensions: [],
    isCA: false,
    keyAlg: "ECDSA-P384",
    keyUsage: ["digital_signature"],
    name: "TLS Client",
    sans: { dns: [], email: [], ip: [], uri: [] },
    subject: { commonName: "", country: "", organization: "" },
    validityDays: 365,
  },
  {
    extKeyUsage: ["server_auth", "client_auth"],
    extraExtensions: [],
    isCA: false,
    keyAlg: "ECDSA-P384",
    keyUsage: ["digital_signature", "key_encipherment"],
    name: "Domain Controller",
    sans: { dns: [], email: [], ip: [], uri: [] },
    subject: { commonName: "", country: "", organization: "" },
    validityDays: 365,
  },
  {
    extKeyUsage: ["code_signing"],
    extraExtensions: [],
    isCA: false,
    keyAlg: "RSA-3072",
    keyUsage: ["digital_signature"],
    name: "Code Signing",
    sans: { dns: [], email: [], ip: [], uri: [] },
    subject: { commonName: "", country: "", organization: "" },
    validityDays: 1095,
  },
  {
    extKeyUsage: [],
    extraExtensions: [],
    isCA: true,
    keyAlg: "ECDSA-P384",
    keyUsage: ["cert_sign", "crl_sign"],
    name: "Subordinate CA",
    pathLen: 0,
    sans: { dns: [], email: [], ip: [], uri: [] },
    subject: { commonName: "", country: "", organization: "" },
    validityDays: 1825,
  },
];

export const MOCK_PROFILES_MARKER = "__CRYPTOS_MOCK_PROFILES__";
Object.assign(mockProfiles, { __mockMarker: MOCK_PROFILES_MARKER });

export const mockAdapters: EnrollmentAdapter[] = [
  {
    challenges: ["http-01", "dns-01"],
    enabled: true,
    endpoint: "https://pki.acme.example/acme/directory",
    kind: "acme",
    name: "ACME (RFC 8555)",
    profile: "TLS Server (LDAPS)",
  },
  {
    enabled: true,
    endpoint: "https://pki.acme.example/adpolicyprovider",
    gpoTemplate: "DomainController",
    kind: "ms-autoenroll",
    name: "Windows Autoenrollment (XCEP/WSTEP)",
    profile: "Domain Controller",
  },
  {
    enabled: false,
    endpoint: "https://pki.acme.example/scep",
    kind: "scep",
    name: "SCEP (RFC 8894)",
    profile: "TLS Client",
  },
  {
    enabled: false,
    endpoint: "https://pki.acme.example/.well-known/est",
    kind: "est",
    name: "EST (RFC 7030)",
    profile: "TLS Client",
  },
];

export const MOCK_ADAPTERS_MARKER = "__CRYPTOS_MOCK_ADAPTERS__";
Object.assign(mockAdapters, { __mockMarker: MOCK_ADAPTERS_MARKER });

export const mockAuditEvents: AuditEvent[] = [
  {
    actorCn: "operator@example.org",
    actorKind: "cert",
    at: daysFromNow(-1),
    id: "aud-0009",
    kind: "revoked",
    outcome: "ok",
    summary: "Revoked svc-9.acme.example (keyCompromise)",
    targetKind: "cert",
    via: "web",
  },
  {
    at: daysFromNow(-2),
    id: "aud-0008",
    kind: "enroll-approved",
    summary: "Approved enrollment acme-issuing-03 under ACME Intermediate CA G1",
    targetKind: "node",
    targetPath: "/nodes/acme-issuing-03",
  },
  {
    at: daysFromNow(-3),
    id: "aud-0007",
    kind: "protocol-toggled",
    summary: "Enabled ACME (RFC 8555)",
    targetKind: "protocol",
    targetPath: "/protocols/acme",
  },
  {
    at: daysFromNow(-4),
    id: "aud-0006",
    kind: "config-applied",
    summary: "Config applied to acme-issuing-01",
    targetKind: "node",
    targetPath: "/nodes/acme-issuing-01",
  },
  {
    at: daysFromNow(-5),
    id: "aud-0005",
    kind: "rekeyed",
    summary: "Re-key ceremony completed for acme-root-01",
    targetKind: "node",
    targetPath: "/root/acme-root-01",
  },
  {
    at: daysFromNow(-6),
    id: "aud-0004",
    kind: "renewed",
    summary: "Renewed ldap-a.acme.example",
    targetKind: "cert",
  },
  {
    at: daysFromNow(-7),
    id: "aud-0003",
    kind: "profile-updated",
    summary: "Updated profile Code Signing",
    targetKind: "profile",
    targetPath: "/profiles/Code Signing",
  },
  {
    at: daysFromNow(-8),
    id: "aud-0002",
    kind: "enroll-rejected",
    summary: "Rejected enrollment acme-issuing-h03 (failed attestation)",
    targetKind: "enrollment",
  },
  {
    at: daysFromNow(-9),
    id: "aud-0001",
    kind: "profile-created",
    summary: "Created profile TLS Server (LDAPS)",
    targetKind: "profile",
    targetPath: "/profiles/TLS Server (LDAPS)",
  },
  {
    actorCn: "operator@example.org",
    actorKind: "mcp_key",
    at: daysFromNow(-10),
    id: "aud-0000",
    kind: "issued",
    outcome: "ok",
    summary: "Issued leaf svc-1.acme.example on acme-issuing-01",
    targetKind: "cert",
    tool: "cert_issue_from_csr",
    via: "mcp",
  },
];

export const MOCK_AUDIT_MARKER = "__CRYPTOS_MOCK_AUDIT__";
Object.assign(mockAuditEvents, { __mockMarker: MOCK_AUDIT_MARKER });
