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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const validateCertificateChain = vi.fn(() =>
  Promise.resolve({
    issuer: "CN=acme-issuing-01",
    nodeCaSubject: "CN=acme-issuing-01",
    reason: "",
    subject: "CN=leaf.acme.example",
    valid: true,
  }),
);
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({ validateCertificateChain }),
}));

import { validateCertificateChain as validateCertificateChainLib } from "@/lib/node-chain-validate";

describe("validateCertificateChain live path", () => {
  beforeEach(() => {
    validateCertificateChain.mockClear();
    vi.stubEnv("VITE_FLEET_MODE", "live");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("forwards the node name and pasted certificate, and returns the manager's result", async () => {
    const result = await validateCertificateChainLib(
      "acme-issuing-01",
      "-----BEGIN CERTIFICATE-----\nleaf\n-----END CERTIFICATE-----",
    );

    expect(validateCertificateChain).toHaveBeenCalledWith(
      expect.objectContaining({
        certificatePem: "-----BEGIN CERTIFICATE-----\nleaf\n-----END CERTIFICATE-----",
        nodeName: "acme-issuing-01",
      }),
    );
    expect(result).toEqual({
      issuer: "CN=acme-issuing-01",
      nodeCaSubject: "CN=acme-issuing-01",
      reason: "",
      subject: "CN=leaf.acme.example",
      valid: true,
    });
  });

  it("reports a certificate that does not chain as a result, not a thrown error", async () => {
    validateCertificateChain.mockResolvedValueOnce({
      issuer: "CN=untrusted-issuer.example",
      nodeCaSubject: "CN=acme-issuing-01",
      reason: "certificate's issuer does not match the node's CA",
      subject: "CN=leaf.acme.example",
      valid: false,
    });
    const result = await validateCertificateChainLib("acme-issuing-01", "pem");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("certificate's issuer does not match the node's CA");
  });
});
