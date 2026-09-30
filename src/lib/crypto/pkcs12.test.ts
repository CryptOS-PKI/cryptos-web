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
import { BasicConstraintsExtension, X509CertificateGenerator } from "@peculiar/x509";
import { describe, expect, it } from "vitest";

import { generateLeafKeyAndCSR, MIN_PASSPHRASE_LENGTH } from "@/lib/crypto/leaf-key";
import { assemblePkcs12 } from "@/lib/crypto/pkcs12";

// A tiny self-signed-looking DER certificate is not required: assemblePkcs12
// treats the cert as opaque DER bytes it wraps in a CertBag, so any byte string
// exercises the envelope shape. The key, though, must be a real WebCrypto key so
// its PKCS#8 export and PBES2 shrouding run for real.
const dummyCertDer = new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x2a]);

const STRONG = "correct-horse-battery-staple";

// A minimal DER reader for the round-trip test: it only has to walk the shapes
// assemblePkcs12 emits (definite lengths, no high tag numbers).
interface Tlv {
  tag: number;
  content: Uint8Array;
}

const readTlv = (bytes: Uint8Array, offset: number): { next: number; tlv: Tlv } => {
  const tag = bytes[offset];
  let len = bytes[offset + 1];
  let start = offset + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let k = 0; k < n; k++) len = (len << 8) | bytes[start + k];
    start += n;
  }
  return { next: start + len, tlv: { content: bytes.subarray(start, start + len), tag } };
};

const children = (content: Uint8Array): Tlv[] => {
  const out: Tlv[] = [];
  let offset = 0;
  while (offset < content.length) {
    const { next, tlv } = readTlv(content, offset);
    out.push(tlv);
    offset = next;
  }
  return out;
};

const only = (bytes: Uint8Array): Tlv => readTlv(bytes, 0).tlv;

const bufferOf = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
};

// unshroudKey pulls the shrouded-key bag out of a PFX, and undoes its PBES2
// (PBKDF2-HMAC-SHA256 + AES-256-CBC) envelope, returning the plain PKCS#8.
const unshroudKey = async (pfx: Uint8Array, passphrase: string): Promise<Uint8Array> => {
  // PFX ::= SEQUENCE { version, authSafe ContentInfo, macData }
  const [, authSafe] = children(only(pfx).content);
  // ContentInfo ::= SEQUENCE { id-data, [0] OCTET STRING (AuthenticatedSafe) }
  const authenticatedSafe = only(only(children(authSafe.content)[1].content).content);
  // The first ContentInfo in the AuthenticatedSafe carries the key SafeContents.
  const [keyContentInfo] = children(authenticatedSafe.content);
  const safeContents = only(only(children(keyContentInfo.content)[1].content).content);
  const [safeBag] = children(safeContents.content);
  // SafeBag ::= SEQUENCE { bagId, [0] EncryptedPrivateKeyInfo }
  const epki = only(children(safeBag.content)[1].content);
  const [algorithm, encryptedData] = children(epki.content);
  const [, pbes2Params] = children(algorithm.content);
  const [kdf, scheme] = children(pbes2Params.content);
  const [salt, iterations] = children(children(kdf.content)[1].content);
  const iv = children(scheme.content)[1];

  let iterationCount = 0;
  for (const b of iterations.content) iterationCount = iterationCount * 256 + b;

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const aesKey = await crypto.subtle.deriveKey(
    { hash: "SHA-256", iterations: iterationCount, name: "PBKDF2", salt: bufferOf(salt.content) },
    baseKey,
    { length: 256, name: "AES-CBC" },
    false,
    ["decrypt"],
  );
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { iv: bufferOf(iv.content), name: "AES-CBC" },
      aesKey,
      bufferOf(encryptedData.content),
    ),
  );
};

// certBags returns the DER certificates from the cert SafeContents (the second
// ContentInfo of the AuthenticatedSafe), in bag order.
const certBags = (pfx: Uint8Array): Uint8Array[] => {
  const [, authSafe] = children(only(pfx).content);
  const authenticatedSafe = only(only(children(authSafe.content)[1].content).content);
  const [, certContentInfo] = children(authenticatedSafe.content);
  const safeContents = only(only(children(certContentInfo.content)[1].content).content);
  return children(safeContents.content).map((bag) => {
    // SafeBag ::= SEQUENCE { bagId, [0] CertBag }; CertBag ::= SEQUENCE { certId, [0] OCTET STRING }
    const cert = only(children(bag.content)[1].content);
    return only(children(cert.content)[1].content).content;
  });
};

const ECDSA_P384 = { name: "ECDSA", namedCurve: "P-384" } as const;
const SHA384 = { name: "ECDSA", hash: "SHA-384" } as const;

// makeAnchorAndLeaf mints a throwaway P-384 CA and a leaf for privateKey's
// public half, so the PFX carries real certificates rather than opaque bytes.
const makeAnchorAndLeaf = async (
  publicKey: CryptoKey,
): Promise<{ anchorDer: Uint8Array; leafDer: Uint8Array }> => {
  const caKeys = await crypto.subtle.generateKey(ECDSA_P384, false, ["sign", "verify"]);
  const anchor = await X509CertificateGenerator.createSelfSigned({
    extensions: [new BasicConstraintsExtension(true, undefined, true)],
    keys: caKeys,
    name: "CN=Example Root CA G1",
    signingAlgorithm: SHA384,
  });
  const leaf = await X509CertificateGenerator.create({
    extensions: [new BasicConstraintsExtension(false, undefined, true)],
    issuer: anchor.subject,
    publicKey,
    signingAlgorithm: SHA384,
    signingKey: caKeys.privateKey,
    subject: "CN=admin@example.org",
  });
  return { anchorDer: new Uint8Array(anchor.rawData), leafDer: new Uint8Array(leaf.rawData) };
};

describe("assemblePkcs12", () => {
  it("rejects a passphrase shorter than the floor", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    await expect(assemblePkcs12(dummyCertDer, privateKey, "short")).rejects.toThrow(
      new RegExp(`${MIN_PASSPHRASE_LENGTH} characters`),
    );
  });

  it("emits a PKCS#12 PFX: an outer SEQUENCE with version 3", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    const pfx = await assemblePkcs12(dummyCertDer, privateKey, STRONG);

    // PFX ::= SEQUENCE { version INTEGER {v3(3)}, authSafe, macData }
    expect(pfx[0]).toBe(0x30); // outer SEQUENCE
    // Walk the length octets, then the first inner element must be INTEGER 3.
    let i = 1;
    if (pfx[i] & 0x80) i += pfx[i] & 0x7f;
    i += 1;
    expect(pfx[i]).toBe(0x02); // INTEGER tag
    expect(pfx[i + 1]).toBe(0x01); // length 1
    expect(pfx[i + 2]).toBe(0x03); // version 3
  });

  it("does not embed the passphrase in the output bytes", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    const pfx = await assemblePkcs12(dummyCertDer, privateKey, STRONG);
    const asText = new TextDecoder("latin1").decode(pfx);
    expect(asText.includes(STRONG)).toBe(false);
  });

  // The browser now mints P-384 operator keys (#138); the shrouded key bag must
  // carry that key intact so the .p12 imports as the same P-384 key.
  it("round-trips a P-384 key through the shrouded key bag", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    expect((privateKey.algorithm as EcKeyAlgorithm).namedCurve).toBe("P-384");

    const pfx = await assemblePkcs12(dummyCertDer, privateKey, STRONG);
    const pkcs8 = await unshroudKey(pfx, STRONG);

    const original = new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey));
    expect(pkcs8).toEqual(original);

    const imported = await crypto.subtle.importKey(
      "pkcs8",
      bufferOf(pkcs8),
      { name: "ECDSA", namedCurve: "P-384" },
      true,
      ["sign"],
    );
    expect((imported.algorithm as EcKeyAlgorithm).namedCurve).toBe("P-384");
  });

  it("carries a single cert bag when no chain is given", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    const pfx = await assemblePkcs12(dummyCertDer, privateKey, STRONG);
    expect(certBags(pfx)).toEqual([dummyCertDer]);
  });

  it("round-trips a P-384 key with the anchor as the chain", async () => {
    const keys = await crypto.subtle.generateKey(ECDSA_P384, true, ["sign", "verify"]);
    const { anchorDer, leafDer } = await makeAnchorAndLeaf(keys.publicKey);

    const pfx = await assemblePkcs12(leafDer, keys.privateKey, STRONG, [anchorDer]);

    expect(certBags(pfx)).toEqual([leafDer, anchorDer]);
    const pkcs8 = await unshroudKey(pfx, STRONG);
    expect(pkcs8).toEqual(new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey)));
    const imported = await crypto.subtle.importKey("pkcs8", bufferOf(pkcs8), ECDSA_P384, true, [
      "sign",
    ]);
    expect((imported.algorithm as EcKeyAlgorithm).namedCurve).toBe("P-384");
  });

  it("labels the key and the leaf with a friendly name when one is given", async () => {
    const keys = await crypto.subtle.generateKey(ECDSA_P384, true, ["sign", "verify"]);
    const { anchorDer, leafDer } = await makeAnchorAndLeaf(keys.publicKey);
    const name = "FleetOS admin (admin@example.org)";

    const pfx = await assemblePkcs12(leafDer, keys.privateKey, STRONG, [anchorDer], {
      friendlyName: name,
    });

    // friendlyName (PKCS#9, 1.2.840.113549.1.9.20) as a BMPString, on the key
    // bag and the leaf's cert bag only.
    const oid = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x14]);
    const bmp = new Uint8Array(name.length * 2);
    for (let i = 0; i < name.length; i += 1) bmp[i * 2 + 1] = name.charCodeAt(i);
    const count = (needle: Uint8Array) => {
      let n = 0;
      for (let i = 0; i + needle.length <= pfx.length; i += 1) {
        if (needle.every((b, k) => pfx[i + k] === b)) n += 1;
      }
      return n;
    };
    expect(count(oid)).toBe(2);
    expect(count(bmp)).toBe(2);
    expect(certBags(pfx)).toEqual([leafDer, anchorDer]);
    expect(await unshroudKey(pfx, STRONG)).toEqual(
      new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey)),
    );
  });

  it("is deterministic in structure but not in ciphertext (random salt/iv)", async () => {
    const { privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: "op" });
    const a = await assemblePkcs12(dummyCertDer, privateKey, STRONG);
    const b = await assemblePkcs12(dummyCertDer, privateKey, STRONG);
    // Both are valid PFX (same tag) but differ because salt/iv are random.
    expect(a[0]).toBe(0x30);
    expect(b[0]).toBe(0x30);
    expect(a.length).toBeGreaterThan(0);
    // Extremely unlikely to be byte-identical given random salts.
    const same = a.length === b.length && a.every((v, idx) => v === b[idx]);
    expect(same).toBe(false);
  });
});
