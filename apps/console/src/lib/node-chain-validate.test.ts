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

import { describe, expect, it } from "vitest";

import { validateCertificateChain } from "@/lib/node-chain-validate";

describe("validateCertificateChain (mock mode)", () => {
  it("reports a pasted certificate as chaining to the node's CA", async () => {
    const result = await validateCertificateChain(
      "acme-issuing-01",
      "-----BEGIN CERTIFICATE-----\nmock\n-----END CERTIFICATE-----",
    );
    expect(result.valid).toBe(true);
    expect(result.reason).toBe("");
    expect(result.nodeCaSubject).toContain("acme-issuing-01");
  });

  it("reports a certificate carrying the UNTRUSTED marker as not chaining", async () => {
    const result = await validateCertificateChain(
      "acme-issuing-01",
      "-----BEGIN CERTIFICATE-----\nUNTRUSTED\n-----END CERTIFICATE-----",
    );
    expect(result.valid).toBe(false);
    expect(result.reason).not.toBe("");
  });
});
