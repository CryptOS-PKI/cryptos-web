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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture every RevokeCertificate/IssueLeaf call so the live paths can be
// asserted without a real fetch. listCertificates resolves with the fixture
// below so the post-write refresh finds the newly issued cert instead of
// hanging.
const revokeCertificate = vi.fn(() => Promise.resolve({}));
const issueLeaf = vi.fn(() => Promise.resolve({ certDer: new Uint8Array() }));
const listCertificatesResult = {
  certificates: [
    {
      issuerNode: "acme-issuing-01",
      kind: "leaf",
      notAfter: "2027-01-01T00:00:00Z",
      notBefore: "2026-01-01T00:00:00Z",
      profile: "TLS Server",
      reason: "",
      revokedAt: "",
      serial: "AA11",
      status: "VALID",
      subjectCn: "web.acme.example",
    },
  ],
};
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({
    issueLeaf,
    listCertificates: () => Promise.resolve(listCertificatesResult),
    revokeCertificate,
  }),
}));

import { issueCert, revokeCert } from "@/lib/certs";

describe("revokeCert live path", () => {
  beforeEach(() => {
    revokeCertificate.mockClear();
    vi.stubEnv("VITE_FLEET_MODE", "live");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls RevokeCertificate with the serial and the RFC 5280 reason code", async () => {
    await revokeCert("0A1B", "keyCompromise");

    expect(revokeCertificate).toHaveBeenCalledTimes(1);
    expect(revokeCertificate).toHaveBeenCalledWith(
      expect.objectContaining({ serialHex: "0A1B", reasonCode: 1 }),
    );
  });

  it("maps cessationOfOperation to reason code 5", async () => {
    await revokeCert("0C0D", "cessationOfOperation");

    expect(revokeCertificate).toHaveBeenCalledWith(
      expect.objectContaining({ serialHex: "0C0D", reasonCode: 5 }),
    );
  });
});

describe("issueCert live path", () => {
  beforeEach(() => {
    issueLeaf.mockClear();
    vi.stubEnv("VITE_FLEET_MODE", "live");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("forwards the CSR + profile to IssueLeaf and returns the refetched cert", async () => {
    const cert = await issueCert("acme-issuing-01", {
      csrDer: new Uint8Array([1, 2, 3]),
      kind: "leaf",
      profile: "TLS Server",
      sans: ["web.acme.example"],
      subjectCn: "web.acme.example",
      validityDays: 90,
    });

    expect(issueLeaf).toHaveBeenCalledTimes(1);
    expect(issueLeaf).toHaveBeenCalledWith(
      expect.objectContaining({
        csrDer: new Uint8Array([1, 2, 3]),
        nodeName: "acme-issuing-01",
        profileName: "TLS Server",
      }),
    );
    expect(cert.serial).toBe("AA11");
    expect(cert.subjectCn).toBe("web.acme.example");
  });

  it("rejects a live issuance with no CSR", async () => {
    await expect(
      issueCert("acme-issuing-01", {
        kind: "leaf",
        subjectCn: "web.acme.example",
        validityDays: 90,
      }),
    ).rejects.toThrow();
    expect(issueLeaf).not.toHaveBeenCalled();
  });
});
