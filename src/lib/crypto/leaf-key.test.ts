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

import { Pkcs10CertificateRequest } from "@peculiar/x509";
import { describe, expect, it } from "vitest";

import {
  exportEncryptedKey,
  generateLeafKeyAndCSR,
  generateStrongPassphrase,
  toPemEncryptedKey,
} from "@/lib/crypto/leaf-key";

// toArrayBuffer copies the CSR bytes into a plain ArrayBuffer so the peculiar
// parser's AsnEncodedType typing is satisfied (Node types a Uint8Array's
// buffer as ArrayBufferLike, which the overload rejects).
const toArrayBuffer = (view: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(view);
  return copy;
};

describe("generateLeafKeyAndCSR", () => {
  it("returns a CSR that parses back with the given CN and an extractable key", async () => {
    const { csrDer, privateKey } = await generateLeafKeyAndCSR({
      sans: ["svc.acme.example"],
      subjectCn: "svc.acme.example",
    });

    expect(csrDer.length).toBeGreaterThan(0);
    expect(privateKey).toBeInstanceOf(CryptoKey);
    expect(privateKey.extractable).toBe(true);

    const csr = new Pkcs10CertificateRequest(toArrayBuffer(csrDer));
    expect(csr.subject).toContain("svc.acme.example");
    await expect(csr.verify()).resolves.toBe(true);
  });

  it("carries the SANs as a subjectAltName extension", async () => {
    const { csrDer } = await generateLeafKeyAndCSR({
      sans: ["a.acme.example", "b.acme.example"],
      subjectCn: "a.acme.example",
    });
    const csr = new Pkcs10CertificateRequest(toArrayBuffer(csrDer));
    const san = csr.getExtension("2.5.29.17");
    expect(san).not.toBeNull();
  });
});

describe("exportEncryptedKey", () => {
  it("returns an ENCRYPTED PRIVATE KEY, never a plain one", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({
      sans: [],
      subjectCn: "svc.acme.example",
    });
    const bytes = await exportEncryptedKey(privateKey, "correct horse battery staple");
    expect(bytes.length).toBeGreaterThan(0);

    const pem = toPemEncryptedKey(bytes);
    expect(pem).toContain("BEGIN ENCRYPTED PRIVATE KEY");
    expect(pem).not.toContain("BEGIN PRIVATE KEY\n");

    // The envelope is a DER SEQUENCE carrying the PBES2 OID (1.2.840.113549.1.5.13),
    // i.e. a real EncryptedPrivateKeyInfo rather than an unencrypted key.
    expect(bytes[0]).toBe(0x30);
    const pbes2Oid = new Uint8Array([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x05, 0x0d]);
    const haystack = Array.from(bytes).join(",");
    expect(haystack).toContain(Array.from(pbes2Oid).join(","));
  });

  it("rejects a passphrase shorter than 18 characters", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({
      sans: [],
      subjectCn: "svc.acme.example",
    });
    await expect(exportEncryptedKey(privateKey, "short")).rejects.toThrow();
  });
});

describe("generateStrongPassphrase", () => {
  it("is at least 18 characters and differs across calls", () => {
    const a = generateStrongPassphrase();
    const b = generateStrongPassphrase();
    expect(a.length).toBeGreaterThanOrEqual(18);
    expect(b.length).toBeGreaterThanOrEqual(18);
    expect(a).not.toBe(b);
  });
});
