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

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { recordAudit } from "@/lib/audit";
import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";
import { mockNodes } from "@/lib/mock-fixtures";
import type { Node } from "@/lib/mock";

import type { Certificate } from "@cryptos-pki/api-client/cryptos/fleet/v1/fleet_pb";

export type CertKind = "leaf" | "subordinate-ca";
export type CertStatus = "EXPIRED" | "REVOKED" | "VALID";
export type RevocationReason =
  "affiliationChanged" | "cessationOfOperation" | "keyCompromise" | "superseded" | "unspecified";

export interface Cert {
  eku: string[];
  issuedAt: string;
  issuerNodeName: string;
  kind: CertKind;
  notAfter: string;
  notBefore: string;
  pathLen?: number;
  profile?: string;
  reason?: RevocationReason;
  revokedAt?: string;
  sans: string[];
  serial: string;
  status: CertStatus;
  subjectCn: string;
  childNodeName?: string;
}

export interface IssueDraft {
  // csrDer is the browser-generated PKCS#10 CSR. The live path forwards it to
  // the manager; the mock path ignores it (it mints a fixture directly).
  csrDer?: Uint8Array;
  eku?: string[];
  kind: CertKind;
  pathLen?: number;
  profile?: string;
  sans?: string[];
  subjectCn: string;
  validityDays: number;
}

// Issuance capability: ESTABLISHED only; Root -> sub-CA, Intermediate -> both,
// Issuing -> leaf. Anything else issues nothing.
export const canIssue = (node: Node): CertKind[] => {
  if (node.identityState !== "ESTABLISHED") return [];
  if (node.role === "root") return ["subordinate-ca"];
  if (node.role === "intermediate") return ["subordinate-ca", "leaf"];
  return ["leaf"];
};

// Deterministic pseudo-serial so seeded fixtures are stable across reloads.
const hex = (seed: number): string => {
  let h = (seed * 2654435761) >>> 0;
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += (h & 0xf).toString(16);
    h >>>= 4;
  }
  return out.toUpperCase();
};

export const MOCK_NOW_MS = Date.parse("2026-07-01T00:00:00Z");

const daysFromNow = (days: number): string =>
  new Date(MOCK_NOW_MS + days * 86_400_000).toISOString();

export const EXPIRING_SOON_DAYS = 30;
export type ExpiryClass = "expired" | "expiring" | "ok";

export const daysUntilExpiry = (cert: Cert): number =>
  Math.floor((Date.parse(cert.notAfter) - MOCK_NOW_MS) / 86_400_000);

export const expiryClass = (cert: Cert): ExpiryClass => {
  if (cert.status === "EXPIRED" || daysUntilExpiry(cert) < 0) return "expired";
  if (daysUntilExpiry(cert) <= EXPIRING_SOON_DAYS) return "expiring";
  return "ok";
};

const seed = (): Cert[] => {
  const out: Cert[] = [];
  let n = 1;
  for (const node of mockNodes) {
    if (canIssue(node).length === 0 && node.identityState !== "REVOKED") continue;
    const count = node.role === "issuing" ? 3 : 2;
    for (let i = 0; i < count; i += 1) {
      const revoked = node.identityState === "REVOKED" || (node.role === "issuing" && i === 2);
      out.push({
        eku: ["serverAuth"],
        issuedAt: daysFromNow(-60 + i * 5),
        issuerNodeName: node.name,
        kind: "leaf",
        notAfter: daysFromNow(300 + i * 5),
        notBefore: daysFromNow(-60 + i * 5),
        sans: [`svc-${n}.acme.example`],
        serial: hex(n),
        status: revoked ? "REVOKED" : "VALID",
        subjectCn: `svc-${n}.acme.example`,
        ...(revoked ? { reason: "cessationOfOperation" as const, revokedAt: daysFromNow(-5) } : {}),
      });
      n += 1;
    }
  }
  // Lifecycle variety so the certificates view shows expiring (amber) + expired
  // (red) states against the fixed clock; the rest of the seed is far-future.
  out.push(
    {
      eku: ["serverAuth"],
      issuedAt: daysFromNow(-350),
      issuerNodeName: "acme-issuing-01",
      kind: "leaf",
      notAfter: daysFromNow(15),
      notBefore: daysFromNow(-350),
      sans: ["ldap-a.acme.example"],
      serial: hex(n++),
      status: "VALID",
      subjectCn: "ldap-a.acme.example",
    },
    {
      eku: ["serverAuth"],
      issuedAt: daysFromNow(-340),
      issuerNodeName: "acme-intermediate-01",
      kind: "leaf",
      notAfter: daysFromNow(25),
      notBefore: daysFromNow(-340),
      sans: ["ldap-b.acme.example"],
      serial: hex(n++),
      status: "VALID",
      subjectCn: "ldap-b.acme.example",
    },
    {
      eku: ["serverAuth"],
      issuedAt: daysFromNow(-368),
      issuerNodeName: "acme-issuing-01",
      kind: "leaf",
      notAfter: daysFromNow(-3),
      notBefore: daysFromNow(-368),
      sans: ["old.acme.example"],
      serial: hex(n++),
      status: "EXPIRED",
      subjectCn: "old.acme.example",
    },
  );
  return out;
};

let certs: Cert[] = seed();
const listeners = new Set<() => void>();
const emit = (): void => {
  for (const l of listeners) l();
};
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// Cache the per-node slice so useSyncExternalStore's getSnapshot is referentially
// stable between emits (React bails out of re-render when the ref is unchanged).
let byNode: Map<string, Cert[]> = new Map();
const reindex = (): void => {
  byNode = new Map();
  for (const c of certs) {
    const arr = byNode.get(c.issuerNodeName) ?? [];
    arr.push(c);
    byNode.set(c.issuerNodeName, arr);
  }
};
reindex();

const EMPTY: Cert[] = [];
export const certsFor = (nodeName: string): Cert[] => byNode.get(nodeName) ?? EMPTY;
export const getCert = (serial: string): Cert | undefined => certs.find((c) => c.serial === serial);

// The live certificate set, populated by ListCertificates over Connect. A
// separate store from the mock certs above: `live`/`live-auth` read this
// array and never touch the mock one, so flipping VITE_FLEET_MODE never
// mixes the two. Mirrors the live-store pattern in lib/nodes.ts.
let liveCerts: Cert[] = [];

// The per-node slice of the live set, rebuilt only when a refresh replaces it.
// A fresh filter() on every getSnapshot call hands useSyncExternalStore a new
// array each time, which React reads as a store change and re-renders forever
// ("Maximum update depth exceeded"), throwing the node detail page.
let liveByNode: Map<string, Cert[]> = new Map();
const reindexLive = (): void => {
  liveByNode = new Map();
  for (const c of liveCerts) {
    const arr = liveByNode.get(c.issuerNodeName) ?? [];
    arr.push(c);
    liveByNode.set(c.issuerNodeName, arr);
  }
};
const liveCertsFor = (nodeName: string): Cert[] => liveByNode.get(nodeName) ?? EMPTY;

const liveListeners = new Set<() => void>();
const emitLive = (): void => {
  for (const l of liveListeners) l();
};
const subscribeLive = (l: () => void): (() => void) => {
  liveListeners.add(l);
  return () => liveListeners.delete(l);
};

const knownCertKinds = new Set<CertKind>(["leaf", "subordinate-ca"]);
const knownCertStatuses = new Set<CertStatus>(["EXPIRED", "REVOKED", "VALID"]);

// Certificate -> the web Cert shape. The manager's read-through view only
// carries what the proto message defines, so `sans`/`eku` (not tracked by
// the live source) default to an empty array rather than being left
// undefined -- the certificates page and node cert-inventory render the
// same fixed shape whether the data came from the mock store or the manager.
const fromCertificate = (certificate: Certificate): Cert => ({
  eku: [],
  issuedAt: certificate.notBefore,
  issuerNodeName: certificate.issuerNode,
  kind: knownCertKinds.has(certificate.kind as CertKind) ? (certificate.kind as CertKind) : "leaf",
  notAfter: certificate.notAfter,
  notBefore: certificate.notBefore,
  profile: certificate.profile || undefined,
  reason: certificate.reason ? (certificate.reason as RevocationReason) : undefined,
  revokedAt: certificate.revokedAt || undefined,
  sans: [],
  serial: certificate.serial,
  status: knownCertStatuses.has(certificate.status as CertStatus)
    ? (certificate.status as CertStatus)
    : "VALID",
  subjectCn: certificate.subjectCn,
});

const CERT_POLL_INTERVAL_MS = 10_000;

// Fetches ListCertificates once and (for `live`/`live-auth`) keeps polling on
// an interval so a newly issued/revoked cert is picked up without a reload.
// Errors are swallowed to a console warning: a manager outage should degrade
// the certificates view to whatever it last had, not throw the page into an
// error boundary.
export const refreshLiveCerts = async (node?: string): Promise<void> => {
  try {
    const response = await fleetClient().listCertificates({ node: node ?? "" });
    liveCerts = response.certificates.map(fromCertificate);
    reindexLive();
    emitLive();
  } catch (error) {
    // eslint-disable-next-line no-console -- surfaced for local live debugging
    console.warn("fleet: ListCertificates failed", error);
  }
};

export const useCerts = (nodeName: string): Cert[] => {
  const mode = fleetMode();

  useEffect(() => {
    if (mode === "mock") return;
    void refreshLiveCerts(nodeName);
    const interval = setInterval(() => void refreshLiveCerts(nodeName), CERT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode, nodeName]);

  return useSyncExternalStore(
    mode === "mock" ? subscribe : subscribeLive,
    () => (mode === "mock" ? certsFor(nodeName) : liveCertsFor(nodeName)),
    () => (mode === "mock" ? certsFor(nodeName) : liveCertsFor(nodeName)),
  );
};

export const allCerts = (): Cert[] => certs;

// useCertCounts is the per-node issued/revoked tally, derived from the
// certificates the manager already returns.
//
// NodeSummary does not carry these numbers, so fromSummary defaults them to 0
// and every node in a live fleet rendered "0 issued" however many it had
// (#85). ListCertificates is correct, so the counts are derived from it rather
// than guessed -- and subscribing through useAllCerts means they arrive and
// re-render rather than depending on whichever page fetched first.
export const useCertCounts = (): Map<string, { issued: number; revoked: number }> => {
  const all = useAllCerts();

  return useMemo(() => {
    const counts = new Map<string, { issued: number; revoked: number }>();
    for (const c of all) {
      if (!c.issuerNodeName) continue;
      const entry = counts.get(c.issuerNodeName) ?? { issued: 0, revoked: 0 };
      entry.issued += 1;
      if (c.status === "REVOKED") entry.revoked += 1;
      counts.set(c.issuerNodeName, entry);
    }

    return counts;
  }, [all]);
};
export const useAllCerts = (): Cert[] => {
  const mode = fleetMode();

  useEffect(() => {
    if (mode === "mock") return;
    void refreshLiveCerts();
    const interval = setInterval(() => void refreshLiveCerts(), CERT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode]);

  return useSyncExternalStore(
    mode === "mock" ? subscribe : subscribeLive,
    () => (mode === "mock" ? certs : liveCerts),
    () => (mode === "mock" ? certs : liveCerts),
  );
};

// live writes: revokeCert (RevokeCertificate) landed first; issueCert is the
// second write wired through to the manager (IssueLeaf). In `mock` mode every
// write still mutates the in-memory store regardless of fleetMode().
let nextSerial = 10_000;

// mockIssue mints a fixture cert directly, unchanged from the pre-live
// behavior. renewCert and every mock-mode caller depend on this synchronous
// shape, so it stays synchronous behind the fleetMode() check.
const mockIssue = (issuerNodeName: string, draft: IssueDraft): Cert => {
  const cert: Cert = {
    eku: draft.eku ?? [],
    issuedAt: daysFromNow(0),
    issuerNodeName,
    kind: draft.kind,
    notAfter: daysFromNow(draft.validityDays),
    notBefore: daysFromNow(0),
    pathLen: draft.kind === "subordinate-ca" ? (draft.pathLen ?? 0) : undefined,
    profile: draft.profile,
    sans: draft.sans ?? [],
    serial: hex(nextSerial++),
    status: "VALID",
    subjectCn: draft.subjectCn,
  };
  certs = [cert, ...certs];
  reindex();
  emit();
  recordAudit({
    kind: "issued",
    summary: `Issued ${cert.kind === "subordinate-ca" ? "sub-CA" : "leaf"} ${cert.subjectCn} on ${issuerNodeName}`,
    targetKind: "cert",
    targetPath: `/nodes/${issuerNodeName}/certs/${cert.serial}`,
  });
  return cert;
};

// issueCert mints a leaf on issuerNodeName. In `mock` mode it adds a fixture
// cert directly. In `live`/`live-auth` mode it forwards the browser-generated
// CSR to the manager's IssueLeaf, then refetches the certificate set
// unfiltered (a node-scoped refetch would transiently collapse the all-nodes
// view) and returns the newly issued cert matching this subject CN.
export const issueCert = async (issuerNodeName: string, draft: IssueDraft): Promise<Cert> => {
  if (fleetMode() === "mock") {
    return mockIssue(issuerNodeName, draft);
  }

  if (!draft.csrDer || draft.csrDer.length === 0) {
    throw new Error("issueCert: a CSR is required to issue live");
  }

  await fleetClient().issueLeaf({
    csrDer: draft.csrDer,
    nodeName: issuerNodeName,
    profileName: draft.profile ?? "",
  });
  // Refetch unfiltered: refreshLiveCerts replaces the whole cache, so a
  // node-scoped refetch would transiently collapse the all-nodes view.
  await refreshLiveCerts();

  const match = liveCerts.find(
    (c) => c.issuerNodeName === issuerNodeName && c.subjectCn === draft.subjectCn,
  );
  if (!match) {
    throw new Error("issueCert: issued certificate did not appear in the fleet");
  }
  return match;
};

// RFC 5280 CRLReason codes for the reasons the revoke dialog offers. The
// manager forwards this code to the issuing node's RevokeCertificate unchanged.
const REASON_CODE: Record<RevocationReason, number> = {
  unspecified: 0,
  keyCompromise: 1,
  affiliationChanged: 3,
  superseded: 4,
  cessationOfOperation: 5,
};

export const revokeCert = async (serial: string, reason: RevocationReason): Promise<void> => {
  if (fleetMode() === "mock") {
    certs = certs.map((c) =>
      c.serial === serial ? { ...c, reason, revokedAt: daysFromNow(0), status: "REVOKED" } : c,
    );
    reindex();
    emit();
    const rc = getCert(serial);
    if (rc)
      recordAudit({
        kind: "revoked",
        summary: `Revoked ${rc.subjectCn} (${reason})`,
        targetKind: "cert",
        targetPath: `/nodes/${rc.issuerNodeName}/certs/${serial}`,
      });
    return;
  }

  const cert = liveCerts.find((c) => c.serial === serial);
  await fleetClient().revokeCertificate({
    nodeName: cert?.issuerNodeName ?? "",
    serialHex: serial,
    reasonCode: REASON_CODE[reason],
  });
  // Refetch unfiltered: refreshLiveCerts replaces the whole cache, so a
  // node-scoped refetch would transiently collapse the all-nodes view.
  await refreshLiveCerts();
};

// Renew: issue a fresh cert with the same subject/profile/kind/sans/eku and a
// validity matching the old cert's original span, then supersede the old one
// (REVOKED + reason "superseded"). One reindex/emit.
export const renewCert = (serial: string): Cert | undefined => {
  const old = certs.find((c) => c.serial === serial);
  if (!old || old.status === "REVOKED") return undefined;
  const span = Math.round((Date.parse(old.notAfter) - Date.parse(old.notBefore)) / 86_400_000);
  const validityDays = span > 0 ? span : 365;
  const fresh: Cert = {
    eku: old.eku,
    issuedAt: daysFromNow(0),
    issuerNodeName: old.issuerNodeName,
    kind: old.kind,
    notAfter: daysFromNow(validityDays),
    notBefore: daysFromNow(0),
    pathLen: old.pathLen,
    profile: old.profile,
    sans: old.sans,
    serial: hex(nextSerial++),
    status: "VALID",
    subjectCn: old.subjectCn,
  };
  certs = [
    fresh,
    ...certs.map((c) =>
      c.serial === serial
        ? {
            ...c,
            reason: "superseded" as const,
            revokedAt: daysFromNow(0),
            status: "REVOKED" as const,
          }
        : c,
    ),
  ];
  reindex();
  emit();
  recordAudit({
    kind: "renewed",
    summary: `Renewed ${fresh.subjectCn}`,
    targetKind: "cert",
    targetPath: `/nodes/${fresh.issuerNodeName}/certs/${fresh.serial}`,
  });
  return fresh;
};

// Test-only: restore the seeded fixtures between tests.
export const __resetCerts = (): void => {
  certs = seed();
  nextSerial = 10_000;
  reindex();
  emit();
};
