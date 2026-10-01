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
import { X509CertificateGenerator } from "@peculiar/x509";
import { describe, expect, it } from "vitest";

import {
  BACKUP_PASSPHRASE_ALPHABET,
  buildCredentialPkcs12,
  generateBackupPassphrase,
  keyBackupFilename,
  keyBackupPem,
  keyMatchesCertificate,
  readCertificateDer,
  readKeyBackup,
} from "@/lib/crypto/key-backup";
import { importEncryptedKey } from "@/lib/crypto/leaf-key";

const EC = { name: "ECDSA", namedCurve: "P-384" } as const;

const newKeys = () =>
  crypto.subtle.generateKey(EC, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;

const selfSigned = async (keys: CryptoKeyPair, cn = "alice@example.org") =>
  X509CertificateGenerator.createSelfSigned({
    keys,
    name: `CN=${cn}`,
    notAfter: new Date(Date.now() + 86_400_000),
    notBefore: new Date(Date.now() - 60_000),
    serialNumber: "01",
    signingAlgorithm: { hash: "SHA-384", name: "ECDSA" },
  });

const pkcs8 = async (key: CryptoKey) => new Uint8Array(await crypto.subtle.exportKey("pkcs8", key));

// A minimal DER walker for the PKCS#12 check below.
const tlv = (b: Uint8Array, o: number) => {
  let len = b[o + 1];
  let start = o + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let k = 0; k < n; k++) len = len * 256 + b[start + k];
    start += n;
  }
  return {
    content: b.subarray(start, start + len),
    next: start + len,
    raw: b.subarray(o, start + len),
    tag: b[o],
  };
};
const kids = (c: Uint8Array) => {
  const out: ReturnType<typeof tlv>[] = [];
  for (let o = 0; o < c.length;) {
    const t = tlv(c, o);
    out.push(t);
    o = t.next;
  }
  return out;
};
const inner = (t: ReturnType<typeof tlv>) => kids(t.content)[0];

// shroudedKeyOf digs the shrouded-key bag's EncryptedPrivateKeyInfo out of a PFX.
const shroudedKeyOf = (pfx: Uint8Array): Uint8Array => {
  const [, authSafe] = kids(tlv(pfx, 0).content);
  const authSafeOctets = inner(kids(authSafe.content)[1]);
  const [keyContentInfo] = kids(tlv(authSafeOctets.content, 0).content);
  const safeContents = inner(kids(keyContentInfo.content)[1]);
  const [bag] = kids(tlv(safeContents.content, 0).content);
  return inner(kids(bag.content)[1]).raw.slice();
};

describe("generateBackupPassphrase", () => {
  it("draws 24 characters from a 64-symbol alphabet", () => {
    expect(new Set(BACKUP_PASSPHRASE_ALPHABET).size).toBe(64);
    const p = generateBackupPassphrase();
    expect(p).toHaveLength(24);
    for (const ch of p) expect(BACKUP_PASSPHRASE_ALPHABET).toContain(ch);
  });

  it("differs every time", () => {
    expect(generateBackupPassphrase()).not.toBe(generateBackupPassphrase());
  });
});

describe("keyBackupFilename", () => {
  it("names the file after the level and the lower-cased email", () => {
    expect(keyBackupFilename("admin", "Alice@Example.org")).toBe(
      "fleetos-admin-alice@example.org.key.pem",
    );
  });
});

describe("key backup round trip", () => {
  it("writes an encrypted PKCS#8 PEM that reads back to the same key", async () => {
    const keys = await newKeys();
    const pass = generateBackupPassphrase();
    const pem = await keyBackupPem(keys.privateKey, pass);
    expect(pem).toMatch(/^-----BEGIN ENCRYPTED PRIVATE KEY-----\n/);
    expect(pem).not.toContain(pass);

    const back = await readKeyBackup(new TextEncoder().encode(pem), pass);
    expect(await pkcs8(back)).toEqual(await pkcs8(keys.privateKey));
  });

  it("also reads the backup as DER", async () => {
    const keys = await newKeys();
    const pass = generateBackupPassphrase();
    const pem = await keyBackupPem(keys.privateKey, pass);
    const b64 = pem.replaceAll(/-----[^-]+-----|\s/g, "");
    const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const back = await readKeyBackup(der, pass);
    expect(await pkcs8(back)).toEqual(await pkcs8(keys.privateKey));
  });

  it("fails cleanly on a wrong passphrase", async () => {
    const keys = await newKeys();
    const pem = await keyBackupPem(keys.privateKey, generateBackupPassphrase());
    await expect(
      readKeyBackup(new TextEncoder().encode(pem), "not-the-right-passphrase-at-all"),
    ).rejects.toThrow(/passphrase is wrong/i);
  });

  it("refuses a file that is not an encrypted key", async () => {
    const pem = "-----BEGIN CERTIFICATE-----\nMAA=\n-----END CERTIFICATE-----\n";
    await expect(readKeyBackup(new TextEncoder().encode(pem), "x".repeat(24))).rejects.toThrow(
      /ENCRYPTED PRIVATE KEY/,
    );
  });
});

describe("readCertificateDer", () => {
  it("reads PEM and DER to the same DER", async () => {
    const cert = await selfSigned(await newKeys());
    const der = new Uint8Array(cert.rawData);
    expect(readCertificateDer(new TextEncoder().encode(cert.toString("pem")))).toEqual(der);
    expect(readCertificateDer(der)).toEqual(der);
  });

  it("refuses something that is not a certificate", () => {
    expect(() => readCertificateDer(new TextEncoder().encode("hello"))).toThrow(/certificate/i);
  });
});

describe("keyMatchesCertificate", () => {
  it("is true for the certificate's own key and false for another", async () => {
    const keys = await newKeys();
    const cert = await selfSigned(keys);
    const der = new Uint8Array(cert.rawData);
    expect(await keyMatchesCertificate(keys.privateKey, der)).toBe(true);
    expect(await keyMatchesCertificate((await newKeys()).privateKey, der)).toBe(false);
  });
});

describe("buildCredentialPkcs12", () => {
  it("protects the PKCS#12 with the key backup's passphrase", async () => {
    const keys = await newKeys();
    const pass = generateBackupPassphrase();
    const backup = new TextEncoder().encode(await keyBackupPem(keys.privateKey, pass));
    const cert = await selfSigned(keys);

    const pfx = await buildCredentialPkcs12({
      backup,
      certDer: new Uint8Array(cert.rawData),
      chainDer: [],
      friendlyName: "FleetOS admin (alice@example.org)",
      passphrase: pass,
    });

    const key = await importEncryptedKey(shroudedKeyOf(pfx), pass);
    expect(await pkcs8(key)).toEqual(await pkcs8(keys.privateKey));
  });

  it("refuses a certificate that does not match the backed-up key", async () => {
    const pass = generateBackupPassphrase();
    const backup = new TextEncoder().encode(await keyBackupPem((await newKeys()).privateKey, pass));
    const other = await selfSigned(await newKeys());
    await expect(
      buildCredentialPkcs12({
        backup,
        certDer: new Uint8Array(other.rawData),
        chainDer: [],
        friendlyName: "x",
        passphrase: pass,
      }),
    ).rejects.toThrow(/does not match/i);
  });
});
