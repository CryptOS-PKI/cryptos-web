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
import {
  BasicConstraintsExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  X509CertificateGenerator,
} from "@peculiar/x509";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CrlSource,
  OcspMode,
  OperatorCAAcknowledgement,
  OperatorCAState,
} from "@/gen/fleet/cryptos/fleet/v1/operator_ca_pb";
import { colonFingerprint, normalizeFingerprint } from "@/lib/fingerprint";
import * as clientMod from "@/lib/fleet/client";
import { errorCode, errorReason } from "@/lib/fleet/error-code";
import * as modeMod from "@/lib/fleet/mode";
import {
  __resetOperatorCAs,
  listOperatorCAs,
  type OperatorCARow,
  operatorCABanners,
  registerOperatorCA,
  registerRequestFields,
  retireOperatorCA,
  setOperatorCACrlSource,
  setOperatorCAOcsp,
  uploadOperatorCrl,
} from "@/lib/operator-cas";

const caCert = async (cn: string) => {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-384" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    extensions: [
      new BasicConstraintsExtension(true, 0, true),
      new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
    ],
    keys,
    name: `CN=${cn}`,
    notAfter: new Date(Date.now() + 3650 * 86_400_000),
    notBefore: new Date(Date.now() - 60_000),
    serialNumber: "01",
    signingAlgorithm: { hash: "SHA-384", name: "ECDSA" },
  });
  return new Uint8Array(cert.rawData);
};

const ca = (over: Partial<OperatorCARow>): OperatorCARow => ({
  acknowledgements: [],
  crl: undefined,
  crlLocation: "",
  crlSource: CrlSource.URL,
  issuer: "CN=Example Operator CA",
  managedByConfig: false,
  notAfter: "2036-01-01T00:00:00Z",
  ocspLastError: "",
  ocspMode: OcspMode.AIA,
  ocspUrl: "",
  registeredAt: "",
  retiredAt: "",
  retiredReason: "",
  sha256: "ab".repeat(32),
  state: OperatorCAState.OPERATOR_CA_STATE_ACTIVE,
  subject: "CN=Example Operator CA",
  warnings: [],
  ...over,
});

const NOW = new Date("2026-09-30T12:00:00Z");
const crl = (thisUpdate: string, nextUpdate: string, stale = false) => ({
  crlNumber: "1",
  fetchedAt: thisUpdate,
  lastError: "",
  nextUpdate,
  revokedCount: 0n,
  stale,
  thisUpdate,
});

beforeEach(() => __resetOperatorCAs());
afterEach(() => vi.restoreAllMocks());

describe("fingerprints", () => {
  it("formats and normalizes SHA-256 fingerprints the way openssl prints them", () => {
    expect(colonFingerprint("0a1b".repeat(16))).toMatch(/^0A:1B:0A:1B/);
    expect(normalizeFingerprint("sha256 Fingerprint=0A:1B:0a:1b")).toBe("0a1b0a1b");
  });
});

describe("operatorCABanners", () => {
  it("flags a trusted CA with no CRL and no OCSP as revocations not observed", () => {
    const banners = operatorCABanners(
      [ca({ crlSource: CrlSource.NONE, ocspMode: OcspMode.OFF })],
      NOW,
    );
    expect(banners.map((b) => b.title)).toEqual(["CA revocations not observed"]);
  });

  it("says OCSP only when there is no CRL but OCSP is on", () => {
    const banners = operatorCABanners(
      [ca({ crlSource: CrlSource.NONE, ocspMode: OcspMode.URL })],
      NOW,
    );
    expect(banners.map((b) => b.title)).toEqual(["CA revocations seen through OCSP only"]);
  });

  it("warns when the CRL is in the last 20% of its validity", () => {
    const banners = operatorCABanners(
      [
        ca({
          crl: crl("2026-09-24T12:00:00Z", "2026-10-01T06:00:00Z"),
          crlSource: CrlSource.UPLOAD,
        }),
      ],
      NOW,
    );
    expect(banners.map((b) => b.title)).toEqual(["CRL expiring"]);
    expect(banners[0].detail).toMatch(/upload a new CRL before 2026-10-01T06:00:00Z/i);
  });

  it("does not warn early in the CRL's validity", () => {
    expect(
      operatorCABanners([ca({ crl: crl("2026-09-29T12:00:00Z", "2026-10-06T12:00:00Z") })], NOW),
    ).toEqual([]);
  });

  it("reports an expired CRL", () => {
    const banners = operatorCABanners(
      [ca({ crl: crl("2026-09-20T12:00:00Z", "2026-09-27T12:00:00Z", true) })],
      NOW,
    );
    expect(banners.map((b) => b.title)).toEqual(["CRL expired"]);
  });

  it("reports an OCSP responder that isn't answering", () => {
    const banners = operatorCABanners([ca({ ocspLastError: "timeout" })], NOW);
    expect(banners.map((b) => b.title)).toEqual(["OCSP responder unreachable"]);
  });

  it("ignores retired CAs", () => {
    expect(
      operatorCABanners(
        [
          ca({
            crlSource: CrlSource.NONE,
            ocspMode: OcspMode.OFF,
            state: OperatorCAState.OPERATOR_CA_STATE_RETIRED,
          }),
        ],
        NOW,
      ),
    ).toEqual([]);
  });
});

describe("registerRequestFields", () => {
  it("builds the oneof, the OCSP mode and the NO_CRL acknowledgement", () => {
    const der = new Uint8Array([1]);
    expect(
      registerRequestFields({
        caCertDer: der,
        confirmSha256: "",
        crl: { kind: "none" },
        ocspMode: "off",
        ocspUrl: "",
      }),
    ).toEqual({
      acknowledgements: [OperatorCAAcknowledgement.OPERATOR_CA_ACKNOWLEDGEMENT_NO_CRL],
      caCertDer: der,
      confirmSha256: "",
      crlSource: { case: "none", value: true },
      ocspMode: OcspMode.OFF,
      ocspUrl: "",
    });
    expect(
      registerRequestFields({
        caCertDer: der,
        confirmSha256: "ab",
        crl: { kind: "url", url: " http://pki.example.org/op.crl " },
        ocspMode: "url",
        ocspUrl: " http://ocsp.example.org/ ",
      }),
    ).toMatchObject({
      acknowledgements: [],
      crlSource: { case: "url", value: "http://pki.example.org/op.crl" },
      ocspMode: OcspMode.URL,
      ocspUrl: "http://ocsp.example.org/",
    });
  });
});

describe("operator CAs (mock mode)", () => {
  beforeEach(() => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
  });

  it("previews, then confirms; the old active CA becomes retiring", async () => {
    // The seeded set has a retiring CA, so retire it first.
    const seeded = await listOperatorCAs();
    const retiring = seeded.find((c) => c.state === OperatorCAState.OPERATOR_CA_STATE_RETIRING);
    if (retiring) await retireOperatorCA(retiring.sha256, false);

    const der = await caCert("Example Operator CA G3");
    const preview = await registerOperatorCA({
      caCertDer: der,
      confirmSha256: "",
      crl: { kind: "none" },
      ocspMode: "aia",
      ocspUrl: "",
    });
    expect(preview.confirmed).toBe(false);
    expect(preview.operatorCa.subject).toBe("CN=Example Operator CA G3");
    expect(preview.adminExtfile).toContain("op_admin");
    expect(preview.operatorCa.sha256).toMatch(/^[0-9a-f]{64}$/);

    const done = await registerOperatorCA({
      caCertDer: der,
      confirmSha256: colonFingerprint(preview.operatorCa.sha256),
      crl: { kind: "none" },
      ocspMode: "aia",
      ocspUrl: "",
    });
    expect(done.confirmed).toBe(true);
    const after = await listOperatorCAs();
    expect(after.find((c) => c.sha256 === preview.operatorCa.sha256)?.state).toBe(
      OperatorCAState.OPERATOR_CA_STATE_ACTIVE,
    );
    expect(
      after.filter((c) => c.state === OperatorCAState.OPERATOR_CA_STATE_RETIRING),
    ).toHaveLength(1);
  });

  it("refuses a new registration while a CA is retiring", async () => {
    const der = await caCert("Example Operator CA G3");
    const error = await registerOperatorCA({
      caCertDer: der,
      confirmSha256: "",
      crl: { kind: "none" },
      ocspMode: "aia",
      ocspUrl: "",
    }).catch((e: unknown) => e);
    expect(errorCode(error)).toBe(1605);
    expect(errorReason(error)).toBe("ROTATION_IN_PROGRESS");
  });

  it("refuses to retire the last active CA", async () => {
    const active = (await listOperatorCAs()).find(
      (c) => c.state === OperatorCAState.OPERATOR_CA_STATE_ACTIVE,
    );
    const error = await retireOperatorCA(active?.sha256 ?? "", true).catch((e: unknown) => e);
    expect(errorCode(error)).toBe(1609);
  });

  it("changes the CRL source and OCSP mode and takes a CRL upload", async () => {
    const active = (await listOperatorCAs()).find(
      (c) => c.state === OperatorCAState.OPERATOR_CA_STATE_ACTIVE,
    );
    const sha = active?.sha256 ?? "";
    expect((await setOperatorCACrlSource(sha, { kind: "none" })).crlSource).toBe(CrlSource.NONE);
    expect(
      (await setOperatorCACrlSource(sha, { der: new Uint8Array([0x30]), kind: "upload" }))
        .crlSource,
    ).toBe(CrlSource.UPLOAD);
    expect((await uploadOperatorCrl(sha, new Uint8Array([0x30]))).crl?.stale).toBe(false);
    const ocsp = await setOperatorCAOcsp(sha, "url", "http://ocsp.example.org/");
    expect(ocsp.operatorCa.ocspMode).toBe(OcspMode.URL);
    expect(ocsp.ocspProbe?.certStatus).toBe("unknown");
  });
});

describe("operator CAs (live mode)", () => {
  it("sends the register fields to FleetService.RegisterOperatorCA", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const rpc = vi
      .fn()
      .mockResolvedValue({ adminExtfile: "x", confirmed: false, operatorCa: ca({}) });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      registerOperatorCA: rpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    const der = new Uint8Array([1]);
    await registerOperatorCA({
      caCertDer: der,
      confirmSha256: "",
      crl: { kind: "url", url: "http://pki.example.org/op.crl" },
      ocspMode: "aia",
      ocspUrl: "",
    });
    expect(rpc).toHaveBeenCalledWith(
      expect.objectContaining({
        caCertDer: der,
        crlSource: { case: "url", value: "http://pki.example.org/op.crl" },
        ocspMode: OcspMode.AIA,
      }),
    );
  });

  it("retires with the self-lockout flag", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const rpc = vi.fn().mockResolvedValue({ operatorCa: ca({}) });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      retireOperatorCA: rpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    await retireOperatorCA("ab", true);
    expect(rpc).toHaveBeenCalledWith({ iUnderstandSelfLockout: true, sha256: "ab" });
  });
});
