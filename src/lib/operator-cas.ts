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
import { Code, ConnectError } from "@connectrpc/connect";
import { X509Certificate } from "@peculiar/x509";

import {
  CrlSource,
  OcspMode,
  OcspSigner,
  OperatorCAAcknowledgement,
  OperatorCAState,
} from "@/gen/fleet/cryptos/fleet/v1/operator_ca_pb";
import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";
import { normalizeFingerprint } from "@/lib/fingerprint";
import { levelExtfileSection } from "@/lib/operators";

// The external operator CAs the Fleet Manager trusts. It holds only their
// certificates, never a key. Registration is two calls: a preview that
// returns the fingerprint, then the same call with confirm_sha256. The admin
// RPCs here run after first run; first run's BootstrapService takes the same
// fields (registerRequestFields), so both screens share the form.

export interface CrlStatusRow {
  crlNumber: string;
  fetchedAt: string;
  lastError: string;
  nextUpdate: string;
  revokedCount: bigint;
  stale: boolean;
  thisUpdate: string;
}

export interface OperatorCARow {
  acknowledgements: OperatorCAAcknowledgement[];
  crl: CrlStatusRow | undefined;
  crlLocation: string;
  crlSource: CrlSource;
  issuer: string;
  managedByConfig: boolean;
  notAfter: string;
  ocspLastError: string;
  ocspMode: OcspMode;
  ocspUrl: string;
  registeredAt: string;
  retiredAt: string;
  retiredReason: string;
  sha256: string;
  state: OperatorCAState;
  subject: string;
  warnings: string[];
}

export interface OcspProbeRow {
  certStatus: string;
  signer: OcspSigner;
  signerNotAfter: string;
  signerSubject: string;
}

export type CrlChoice =
  { der: Uint8Array; kind: "upload" } | { kind: "none" } | { kind: "url"; url: string };

export type OcspChoice = "aia" | "off" | "url";

export const crlChoiceReady = (
  kind: CrlChoice["kind"],
  url: string,
  crlFile: null | Uint8Array,
  ack: boolean,
): boolean =>
  (kind === "url" && url.trim() !== "") ||
  (kind === "upload" && crlFile !== null) ||
  (kind === "none" && ack);

export const buildCrlChoice = (
  kind: CrlChoice["kind"],
  url: string,
  crlFile: null | Uint8Array,
): CrlChoice => {
  if (kind === "upload") return { der: crlFile ?? new Uint8Array(), kind };
  if (kind === "url") return { kind, url };
  return { kind: "none" };
};

export interface RegisterForm {
  caCertDer: Uint8Array;
  confirmSha256: string;
  crl: CrlChoice;
  ocspMode: OcspChoice;
  ocspUrl: string;
}

export interface RegisterResult {
  adminExtfile: string;
  confirmed: boolean;
  ocspProbe: OcspProbeRow | undefined;
  operatorCa: OperatorCARow;
}

export const OCSP_MODES: Record<OcspChoice, OcspMode> = {
  aia: OcspMode.AIA,
  off: OcspMode.OFF,
  url: OcspMode.URL,
};

export const crlSourceLabel = (source: CrlSource): string =>
  ({
    [CrlSource.NONE]: "none",
    [CrlSource.PATH]: "file",
    [CrlSource.UNSPECIFIED]: "-",
    [CrlSource.UPLOAD]: "upload",
    [CrlSource.URL]: "url",
  })[source];

export const ocspModeLabel = (mode: OcspMode): string =>
  ({
    [OcspMode.AIA]: "aia",
    [OcspMode.OFF]: "off",
    [OcspMode.UNSPECIFIED]: "aia",
    [OcspMode.URL]: "url",
  })[mode];

export const stateLabel = (state: OperatorCAState): string =>
  ({
    [OperatorCAState.OPERATOR_CA_STATE_ACTIVE]: "active",
    [OperatorCAState.OPERATOR_CA_STATE_RETIRED]: "retired",
    [OperatorCAState.OPERATOR_CA_STATE_RETIRING]: "retiring",
    [OperatorCAState.OPERATOR_CA_STATE_UNSPECIFIED]: "preview",
  })[state];

const crlOneof = (crl: CrlChoice) => {
  switch (crl.kind) {
    case "none": {
      return { case: "none" as const, value: true };
    }
    case "upload": {
      return { case: "crlDer" as const, value: new Uint8Array(crl.der) };
    }
    case "url": {
      return { case: "url" as const, value: crl.url.trim() };
    }
  }
};

const noCrlAck = (crl: CrlChoice): OperatorCAAcknowledgement[] =>
  crl.kind === "none" ? [OperatorCAAcknowledgement.OPERATOR_CA_ACKNOWLEDGEMENT_NO_CRL] : [];

// registerRequestFields is the request body shared by FleetService and
// BootstrapService RegisterOperatorCA. Choosing no CRL carries the NO_CRL
// acknowledgement; the form only allows it once the operator ticks it.
export const registerRequestFields = (form: RegisterForm) => ({
  acknowledgements: noCrlAck(form.crl),
  caCertDer: new Uint8Array(form.caCertDer),
  confirmSha256: form.confirmSha256,
  crlSource: crlOneof(form.crl),
  ocspMode: OCSP_MODES[form.ocspMode],
  ocspUrl: form.ocspMode === "url" ? form.ocspUrl.trim() : "",
});

type WireCA = Partial<Omit<OperatorCARow, "crl">> & { crl?: Partial<CrlStatusRow> };

export const toCARow = (w: WireCA | undefined): OperatorCARow => ({
  acknowledgements: [...(w?.acknowledgements ?? [])],
  crl: w?.crl
    ? {
        crlNumber: w.crl.crlNumber ?? "",
        fetchedAt: w.crl.fetchedAt ?? "",
        lastError: w.crl.lastError ?? "",
        nextUpdate: w.crl.nextUpdate ?? "",
        revokedCount: w.crl.revokedCount ?? 0n,
        stale: w.crl.stale ?? false,
        thisUpdate: w.crl.thisUpdate ?? "",
      }
    : undefined,
  crlLocation: w?.crlLocation ?? "",
  crlSource: w?.crlSource ?? CrlSource.UNSPECIFIED,
  issuer: w?.issuer ?? "",
  managedByConfig: w?.managedByConfig ?? false,
  notAfter: w?.notAfter ?? "",
  ocspLastError: w?.ocspLastError ?? "",
  ocspMode: w?.ocspMode ?? OcspMode.UNSPECIFIED,
  ocspUrl: w?.ocspUrl ?? "",
  registeredAt: w?.registeredAt ?? "",
  retiredAt: w?.retiredAt ?? "",
  retiredReason: w?.retiredReason ?? "",
  sha256: w?.sha256 ?? "",
  state: w?.state ?? OperatorCAState.OPERATOR_CA_STATE_UNSPECIFIED,
  subject: w?.subject ?? "",
  warnings: [...(w?.warnings ?? [])],
});

export const toProbeRow = (p: Partial<OcspProbeRow> | undefined): OcspProbeRow | undefined =>
  p
    ? {
        certStatus: p.certStatus ?? "",
        signer: p.signer ?? OcspSigner.UNSPECIFIED,
        signerNotAfter: p.signerNotAfter ?? "",
        signerSubject: p.signerSubject ?? "",
      }
    : undefined;

export const toRegisterResult = (r: {
  adminExtfile?: string;
  confirmed?: boolean;
  ocspProbe?: Partial<OcspProbeRow>;
  operatorCa?: WireCA;
}): RegisterResult => ({
  adminExtfile: r.adminExtfile ?? "",
  confirmed: r.confirmed ?? false,
  ocspProbe: toProbeRow(r.ocspProbe),
  operatorCa: toCARow(r.operatorCa),
});

export interface OperatorCABanner {
  detail: string;
  sha256: string;
  title: string;
  tone: "danger" | "warning";
}

const trusted = (c: OperatorCARow): boolean =>
  c.state === OperatorCAState.OPERATOR_CA_STATE_ACTIVE ||
  c.state === OperatorCAState.OPERATOR_CA_STATE_RETIRING;

// operatorCABanners lists what an admin must act on, per trusted CA: no way
// to see the CA's revocations, a CRL near or past its nextUpdate (the warning
// starts in the last 20% of the CRL's validity), or a silent OCSP responder.
export const operatorCABanners = (
  cas: OperatorCARow[],
  now: Date = new Date(),
): OperatorCABanner[] => {
  const out: OperatorCABanner[] = [];
  for (const c of cas.filter(trusted)) {
    const ocspOn = c.ocspMode !== OcspMode.OFF;
    if (c.crlSource === CrlSource.NONE) {
      out.push(
        ocspOn
          ? {
              detail: `${c.subject} has no CRL. Revocations made at the CA are seen only while its OCSP responder answers, and MCP is refused for its certificates.`,
              sha256: c.sha256,
              title: "CA revocations seen through OCSP only",
              tone: "warning",
            }
          : {
              detail: `${c.subject} has no CRL and no OCSP. Revocations made at the CA aren't seen: deny credentials at the Fleet Manager too. MCP is refused for its certificates.`,
              sha256: c.sha256,
              title: "CA revocations not observed",
              tone: "danger",
            },
      );
    }
    const crl = c.crl;
    if (crl && crl.nextUpdate) {
      const next = Date.parse(crl.nextUpdate);
      const start = Date.parse(crl.thisUpdate);
      const fix =
        c.crlSource === CrlSource.UPLOAD
          ? `Upload a new CRL before ${crl.nextUpdate}.`
          : `Publish a new CRL at the CA before ${crl.nextUpdate}.`;
      if (crl.stale || next <= now.getTime()) {
        out.push({
          detail: `The CRL for ${c.subject} passed its nextUpdate (${crl.nextUpdate}). ${c.crlSource === CrlSource.UPLOAD ? "Upload" : "Publish"} a new CRL now; MCP is refused for its certificates until then.`,
          sha256: c.sha256,
          title: "CRL expired",
          tone: "danger",
        });
      } else if (!Number.isNaN(start) && next - now.getTime() <= 0.2 * (next - start)) {
        out.push({
          detail: `The CRL for ${c.subject} expires soon. ${fix}`,
          sha256: c.sha256,
          title: "CRL expiring",
          tone: "warning",
        });
      }
    }
    if (ocspOn && c.ocspLastError) {
      out.push({
        detail: `The OCSP responder for ${c.subject} isn't answering: ${c.ocspLastError}`,
        sha256: c.sha256,
        title: "OCSP responder unreachable",
        tone: "warning",
      });
    }
  }
  return out;
};

// Mock mode: a self-consistent set (an active CA whose CRL is expiring, a
// retiring CA with no CRL and no OCSP, one retired) mutated in place.
const iso = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");

const seed = (): OperatorCARow[] => [
  toCARow({
    crl: {
      crlNumber: "4100",
      fetchedAt: iso(-6),
      nextUpdate: iso(1),
      revokedCount: 2n,
      thisUpdate: iso(-6),
    },
    crlLocation: "http://pki.example.org/fleetos-operator.crl",
    crlSource: CrlSource.URL,
    issuer: "CN=Example Operator CA G2,O=Example",
    notAfter: "2036-09-01T00:00:00Z",
    ocspMode: OcspMode.AIA,
    registeredAt: "2026-09-20T10:00:00Z",
    sha256: "2b".repeat(32),
    state: OperatorCAState.OPERATOR_CA_STATE_ACTIVE,
    subject: "CN=Example Operator CA G2,O=Example",
  }),
  toCARow({
    acknowledgements: [OperatorCAAcknowledgement.OPERATOR_CA_ACKNOWLEDGEMENT_NO_CRL],
    crlSource: CrlSource.NONE,
    issuer: "CN=Example Operator CA G1,O=Example",
    notAfter: "2030-01-01T00:00:00Z",
    ocspMode: OcspMode.OFF,
    registeredAt: "2026-06-01T10:00:00Z",
    sha256: "1a".repeat(32),
    state: OperatorCAState.OPERATOR_CA_STATE_RETIRING,
    subject: "CN=Example Operator CA G1,O=Example",
  }),
  toCARow({
    crlSource: CrlSource.UPLOAD,
    issuer: "CN=Example Lab Operator CA,O=Example",
    notAfter: "2027-01-01T00:00:00Z",
    registeredAt: "2026-01-01T10:00:00Z",
    retiredAt: "2026-06-01T10:00:00Z",
    retiredReason: "retired",
    sha256: "0c".repeat(32),
    state: OperatorCAState.OPERATOR_CA_STATE_RETIRED,
    subject: "CN=Example Lab Operator CA,O=Example",
  }),
];

let mockCAs = seed();

const refusal = (code: number, reason: string, message: string): ConnectError =>
  new ConnectError(message, Code.FailedPrecondition, {
    "x-cryptos-error-code": String(code),
    "x-cryptos-error-reason": reason,
  });

const hex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

const mockPreview = async (form: RegisterForm): Promise<OperatorCARow> => {
  const cert = new X509Certificate(new Uint8Array(form.caCertDer));
  const sha256 = hex(await crypto.subtle.digest("SHA-256", new Uint8Array(cert.rawData)));
  return toCARow({
    acknowledgements: noCrlAck(form.crl),
    crl:
      form.crl.kind === "none"
        ? undefined
        : { fetchedAt: iso(0), nextUpdate: iso(7), revokedCount: 0n, thisUpdate: iso(0) },
    crlLocation: form.crl.kind === "url" ? form.crl.url.trim() : "",
    crlSource: { none: CrlSource.NONE, upload: CrlSource.UPLOAD, url: CrlSource.URL }[
      form.crl.kind
    ],
    issuer: cert.issuer,
    notAfter: cert.notAfter.toISOString().replace(/\.\d+Z$/, "Z"),
    ocspMode: OCSP_MODES[form.ocspMode],
    ocspUrl: form.ocspMode === "url" ? form.ocspUrl.trim() : "",
    sha256,
    subject: cert.subject,
  });
};

const mockProbe = (mode: OcspChoice): OcspProbeRow | undefined =>
  mode === "url"
    ? {
        certStatus: "unknown",
        signer: OcspSigner.DELEGATED,
        signerNotAfter: iso(30),
        signerSubject: "CN=Example Operator OCSP",
      }
    : undefined;

const findMock = (sha256: string): OperatorCARow => {
  const row = mockCAs.find((c) => c.sha256 === sha256);
  if (!row) throw new Error(`No operator CA ${sha256}`);
  return row;
};

const updateMock = (sha256: string, patch: Partial<OperatorCARow>): OperatorCARow => {
  const next = { ...findMock(sha256), ...patch };
  mockCAs = mockCAs.map((c) => (c.sha256 === sha256 ? next : c));
  return { ...next };
};

export const listOperatorCAs = async (): Promise<OperatorCARow[]> => {
  if (fleetMode() === "mock") return mockCAs.map((c) => ({ ...c }));
  const response = await fleetClient().listOperatorCAs({});
  return response.items.map((item) => toCARow(item));
};

export const registerOperatorCA = async (form: RegisterForm): Promise<RegisterResult> => {
  if (fleetMode() === "mock") {
    if (mockCAs.some((c) => c.state === OperatorCAState.OPERATOR_CA_STATE_RETIRING)) {
      throw refusal(1605, "ROTATION_IN_PROGRESS", "a retiring operator CA already exists");
    }
    const preview = await mockPreview(form);
    const result = {
      adminExtfile: levelExtfileSection("admin"),
      confirmed: false,
      ocspProbe: mockProbe(form.ocspMode),
      operatorCa: preview,
    };
    if (form.confirmSha256 === "") return result;
    if (normalizeFingerprint(form.confirmSha256) !== preview.sha256) {
      throw refusal(1605, "NOT_CONFIRMED", "confirm_sha256 does not match");
    }
    const stored = {
      ...preview,
      registeredAt: iso(0),
      state: OperatorCAState.OPERATOR_CA_STATE_ACTIVE,
    };
    mockCAs = [
      stored,
      ...mockCAs.map((c) =>
        c.state === OperatorCAState.OPERATOR_CA_STATE_ACTIVE
          ? { ...c, state: OperatorCAState.OPERATOR_CA_STATE_RETIRING }
          : c,
      ),
    ];
    return { ...result, confirmed: true, operatorCa: { ...stored } };
  }
  return toRegisterResult(await fleetClient().registerOperatorCA(registerRequestFields(form)));
};

export const retireOperatorCA = async (
  sha256: string,
  iUnderstandSelfLockout: boolean,
): Promise<OperatorCARow> => {
  if (fleetMode() === "mock") {
    const row = findMock(sha256);
    const active = mockCAs.filter((c) => c.state === OperatorCAState.OPERATOR_CA_STATE_ACTIVE);
    if (row.state === OperatorCAState.OPERATOR_CA_STATE_ACTIVE && active.length === 1) {
      throw refusal(1609, "", "the last active operator CA can't be retired");
    }
    return updateMock(sha256, {
      retiredAt: iso(0),
      retiredReason: "retired",
      state: OperatorCAState.OPERATOR_CA_STATE_RETIRED,
    });
  }
  const response = await fleetClient().retireOperatorCA({ iUnderstandSelfLockout, sha256 });
  return toCARow(response.operatorCa);
};

export const setOperatorCACrlSource = async (
  sha256: string,
  crl: CrlChoice,
): Promise<OperatorCARow> => {
  if (fleetMode() === "mock") {
    return updateMock(sha256, {
      acknowledgements: noCrlAck(crl),
      crl:
        crl.kind === "none"
          ? undefined
          : toCARow({ crl: { nextUpdate: iso(7), thisUpdate: iso(0) } }).crl,
      crlLocation: crl.kind === "url" ? crl.url.trim() : "",
      crlSource: { none: CrlSource.NONE, upload: CrlSource.UPLOAD, url: CrlSource.URL }[crl.kind],
    });
  }
  const response = await fleetClient().setOperatorCACRLSource({
    acknowledgements: noCrlAck(crl),
    crlSource: crlOneof(crl),
    sha256,
  });
  return toCARow(response.operatorCa);
};

export const uploadOperatorCrl = async (
  sha256: string,
  crlDer: Uint8Array,
): Promise<OperatorCARow> => {
  if (fleetMode() === "mock") {
    return updateMock(sha256, {
      crl: toCARow({ crl: { fetchedAt: iso(0), nextUpdate: iso(7), thisUpdate: iso(0) } }).crl,
    });
  }
  const response = await fleetClient().uploadOperatorCRL({ crlDer, sha256 });
  return toCARow(response.operatorCa);
};

export const setOperatorCAOcsp = async (
  sha256: string,
  mode: OcspChoice,
  url: string,
): Promise<{ ocspProbe: OcspProbeRow | undefined; operatorCa: OperatorCARow }> => {
  if (fleetMode() === "mock") {
    return {
      ocspProbe: mockProbe(mode),
      operatorCa: updateMock(sha256, {
        ocspLastError: "",
        ocspMode: OCSP_MODES[mode],
        ocspUrl: mode === "url" ? url.trim() : "",
      }),
    };
  }
  const response = await fleetClient().setOperatorCAOCSP({
    ocspMode: OCSP_MODES[mode],
    ocspUrl: mode === "url" ? url.trim() : "",
    sha256,
  });
  return { ocspProbe: toProbeRow(response.ocspProbe), operatorCa: toCARow(response.operatorCa) };
};

// Test-only: restore the seeded mock set between tests.
export const __resetOperatorCAs = (): void => {
  mockCAs = seed();
};
