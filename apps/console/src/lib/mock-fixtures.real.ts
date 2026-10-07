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
import type { IdentityState, Node, NodeProtocolStatus } from "@/lib/mock";

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
  protocolsByIndex?: Record<number, NodeProtocolStatus[]>;
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
      protocols: protocolsByIndex?.[i],
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
