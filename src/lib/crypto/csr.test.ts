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

import "reflect-metadata";
import { Pkcs10CertificateRequestGenerator } from "@peculiar/x509";
import { describe, expect, it } from "vitest";

import { parseCsr } from "@/lib/crypto/csr";

// Build real CSRs rather than pasting fixtures: the parser has to hold against
// what a generator actually emits, including the signature it has to verify.
const makeCsr = async (
  subjectCn: string,
  algorithm: EcKeyGenParams | RsaHashedKeyGenParams,
  signingAlgorithm: EcdsaParams | RsaHashedKeyGenParams,
  sans: string[] = [],
): Promise<string> => {
  const keys = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
  const csr = await Pkcs10CertificateRequestGenerator.create({
    extensions: [],
    keys,
    name: `CN=${subjectCn}`,
    signingAlgorithm,
    ...(sans.length > 0 ? {} : {}),
  });

  return csr.toString("pem");
};

const P384: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-384" };
const P384_SIGN: EcdsaParams = { hash: "SHA-384", name: "ECDSA" };
const RSA3072: RsaHashedKeyGenParams = {
  hash: "SHA-256",
  modulusLength: 3072,
  name: "RSASSA-PKCS1-v1_5",
  publicExponent: new Uint8Array([1, 0, 1]),
};

describe("parseCsr", () => {
  it("reads the subject and the key from an ECDSA request", async () => {
    const pem = await makeCsr("host.acme.example", P384, P384_SIGN);

    const parsed = await parseCsr(pem);

    expect(parsed.subjectCn).toBe("host.acme.example");
    expect(parsed.keyDescription).toBe("ECDSA P-384");
    expect(parsed.csrDer.length).toBeGreaterThan(0);
  });

  // The case this exists for: an appliance that generates its own RSA key. The
  // reported size is what decides whether the CA will certify it at all, since
  // cryptos enforces a 3072-bit floor on subject keys.
  it("reports the modulus size of an RSA request", async () => {
    const pem = await makeCsr("vcenter.acme.example", RSA3072, RSA3072);

    const parsed = await parseCsr(pem);

    expect(parsed.keyDescription).toBe("RSA 3072");
    expect(parsed.keyBits).toBe(3072);
  });

  it("rejects something that is not a request", async () => {
    await expect(parseCsr("hello")).rejects.toThrow(/not a PKCS#10/i);
  });

  it("rejects an empty paste with an instruction", async () => {
    await expect(parseCsr("   ")).rejects.toThrow(/paste a pkcs#10/i);
  });

  // A truncated paste is the common accident, and it must not reach the node.
  it("rejects a request whose signature does not verify", async () => {
    const pem = await makeCsr("host.acme.example", P384, P384_SIGN);
    const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
    // Flip bits inside the signature, which trails the request body.
    const mangledBody =
      body.slice(0, -8) + (body.slice(-8) === "AAAAAAAA" ? "BBBBBBBB" : "AAAAAAAA");
    const mangled = `-----BEGIN CERTIFICATE REQUEST-----\n${mangledBody}\n-----END CERTIFICATE REQUEST-----`;

    await expect(parseCsr(mangled)).rejects.toThrow();
  });
});
