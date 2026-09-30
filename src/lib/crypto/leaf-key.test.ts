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

import {
  BasicConstraintsExtension,
  ExtendedKeyUsage,
  ExtendedKeyUsageExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  Pkcs10CertificateRequest,
} from "@peculiar/x509";
import { describe, expect, it } from "vitest";

import {
  exportEncryptedKey,
  generateLeafKeyAndCSR,
  generateStrongPassphrase,
  importEncryptedKey,
  OPERATOR_LEVEL_OID,
  toPemEncryptedKey,
} from "@/lib/crypto/leaf-key";

// toArrayBuffer copies the CSR bytes into a plain ArrayBuffer so the peculiar
// parser's AsnEncodedType typing is satisfied (Node types a Uint8Array's
// buffer as ArrayBufferLike, which the overload rejects).
// Pkcs10CertificateRequest.getExtension matches on the OID string only.
const OID_EKU = "2.5.29.37";
const OID_KEY_USAGE = "2.5.29.15";
const OID_BASIC_CONSTRAINTS = "2.5.29.19";

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

  // CryptOS nodes certify ECDSA subject keys on P-384 only, and the external
  // CAs used for operator credentials expect P-384 too (#138).
  it("mints a P-384 key and signs the CSR with ECDSA-SHA384", async () => {
    const { csrDer, privateKey } = await generateLeafKeyAndCSR({
      sans: [],
      subjectCn: "op.acme.example",
    });

    expect((privateKey.algorithm as EcKeyAlgorithm).namedCurve).toBe("P-384");

    const csr = new Pkcs10CertificateRequest(toArrayBuffer(csrDer));
    const publicKey = await csr.publicKey.export();
    expect((publicKey.algorithm as EcKeyAlgorithm).namedCurve).toBe("P-384");
    expect(csr.signatureAlgorithm.name).toBe("ECDSA");
    expect((csr.signatureAlgorithm as EcdsaParams).hash).toMatchObject({ name: "SHA-384" });
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

describe("generateLeafKeyAndCSR extensionRequest", () => {
  it("requests the operator profile: level (non-critical), EKU, KU and BC (critical)", async () => {
    const { csrDer } = await generateLeafKeyAndCSR({
      extensionRequest: { level: "admin" },
      sans: [],
      subjectCn: "admin@example.org",
    });
    const csr = new Pkcs10CertificateRequest(toArrayBuffer(csrDer));
    await expect(csr.verify()).resolves.toBe(true);

    // The level extension must be non-critical: Go's x509.Verify, which the
    // TLS server runs on client certs, refuses unhandled critical extensions.
    const level = csr.getExtension(OPERATOR_LEVEL_OID);
    expect(level).not.toBeNull();
    expect(level?.critical).toBe(false);
    // An ASN.1 PrintableString carrying the level token.
    expect(new Uint8Array(level!.value)).toEqual(
      new Uint8Array([0x13, 0x05, ...new TextEncoder().encode("admin")]),
    );

    const eku = csr.getExtension(OID_EKU) as ExtendedKeyUsageExtension | null;
    expect(eku).not.toBeNull();
    expect(eku?.critical).toBe(false);
    expect(eku?.usages).toEqual([ExtendedKeyUsage.clientAuth]);

    const ku = csr.getExtension(OID_KEY_USAGE) as KeyUsagesExtension | null;
    expect(ku?.critical).toBe(true);
    expect(ku?.usages).toBe(KeyUsageFlags.digitalSignature);

    const bc = csr.getExtension(OID_BASIC_CONSTRAINTS) as BasicConstraintsExtension | null;
    expect(bc?.critical).toBe(true);
    expect(bc?.ca).toBe(false);
  });

  it("encodes each level token", async () => {
    for (const token of ["viewer", "operator"] as const) {
      const { csrDer } = await generateLeafKeyAndCSR({
        extensionRequest: { level: token },
        sans: [],
        subjectCn: "op@example.org",
      });
      const csr = new Pkcs10CertificateRequest(toArrayBuffer(csrDer));
      const value = new Uint8Array(csr.getExtension(OPERATOR_LEVEL_OID)!.value);
      expect(value[0]).toBe(0x13);
      expect(new TextDecoder().decode(value.subarray(2))).toBe(token);
    }
  });

  it("adds no operator extensions without the option", async () => {
    const { csrDer } = await generateLeafKeyAndCSR({
      sans: ["svc.acme.example"],
      subjectCn: "svc.acme.example",
    });
    const csr = new Pkcs10CertificateRequest(toArrayBuffer(csrDer));
    expect(csr.getExtension(OPERATOR_LEVEL_OID)).toBeNull();
    expect(csr.getExtension(OID_EKU)).toBeNull();
    expect(csr.getExtension(OID_KEY_USAGE)).toBeNull();
    expect(csr.getExtension(OID_BASIC_CONSTRAINTS)).toBeNull();
  });
});

describe("importEncryptedKey", () => {
  const PASSPHRASE = "correct horse battery staple";

  it("round-trips with exportEncryptedKey to the same usable P-384 key", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    const encrypted = await exportEncryptedKey(privateKey, PASSPHRASE);

    const imported = await importEncryptedKey(encrypted, PASSPHRASE);

    expect(imported.type).toBe("private");
    expect(imported.extractable).toBe(true);
    expect((imported.algorithm as EcKeyAlgorithm).namedCurve).toBe("P-384");
    const original = new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey));
    const recovered = new Uint8Array(await crypto.subtle.exportKey("pkcs8", imported));
    expect(recovered).toEqual(original);
  });

  it("imports a P-256 key backup too", async () => {
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    const encrypted = await exportEncryptedKey(keys.privateKey, PASSPHRASE);
    const imported = await importEncryptedKey(encrypted, PASSPHRASE);
    expect((imported.algorithm as EcKeyAlgorithm).namedCurve).toBe("P-256");
  });

  it("fails cleanly on a wrong passphrase", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    const encrypted = await exportEncryptedKey(privateKey, PASSPHRASE);
    await expect(importEncryptedKey(encrypted, "wrong horse battery staple")).rejects.toThrow(
      "The passphrase is wrong or the key file is damaged.",
    );
  });

  it("refuses bytes that are not a PBES2 encrypted key", async () => {
    await expect(
      importEncryptedKey(new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x00]), PASSPHRASE),
    ).rejects.toThrow("Not a supported encrypted private key");
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
