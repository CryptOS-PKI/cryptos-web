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
import {
  type JsonGeneralName,
  Pkcs10CertificateRequestGenerator,
  SubjectAlternativeNameExtension,
} from "@peculiar/x509";

// The leaf keypair is ECDSA P-256, generated in the browser with WebCrypto.
// The private key is extractable so it can be exported -- but only ever as a
// passphrase-encrypted PKCS#8, never in plaintext.
const LEAF_KEY_ALGORITHM: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };
const CSR_SIGNING_ALGORITHM: EcdsaParams = { name: "ECDSA", hash: "SHA-256" };

// The 18-character floor is a hard, in-code guard on every export path -- the
// UI never gets to skip it, and there is no plaintext branch to fall back to.
export const MIN_PASSPHRASE_LENGTH = 18;

// PBES2 with PBKDF2 (HMAC-SHA-256) key derivation and AES-256-CBC encryption,
// the RFC 8018 object identifiers for the encrypted-PKCS#8 envelope.
export const OID_PBES2 = "1.2.840.113549.1.5.13";
export const OID_PBKDF2 = "1.2.840.113549.1.5.12";
export const OID_HMAC_SHA256 = "1.2.840.113549.2.9";
export const OID_AES_256_CBC = "2.16.840.1.101.3.4.1.42";

export const PBKDF2_ITERATIONS = 210_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 16;

// generateLeafKeyAndCSR mints an extractable ECDSA P-256 keypair in the
// browser and builds a PKCS#10 CSR carrying the subject CN and, when SANs are
// supplied, a subjectAltName extension. Only the DER CSR is meant to leave the
// browser; privateKey stays in memory for the caller to export on demand.
export const generateLeafKeyAndCSR = async (params: {
  keyAlg?: "ECDSA-P256";
  sans: string[];
  subjectCn: string;
}): Promise<{ csrDer: Uint8Array; privateKey: CryptoKey }> => {
  const keys = await crypto.subtle.generateKey(LEAF_KEY_ALGORITHM, true, ["sign", "verify"]);

  const sans = params.sans.map((s) => s.trim()).filter(Boolean);
  const sanNames: JsonGeneralName[] = sans.map((value) => ({ type: "dns", value }));
  const extensions = sanNames.length > 0 ? [new SubjectAlternativeNameExtension(sanNames)] : [];

  const csr = await Pkcs10CertificateRequestGenerator.create({
    extensions,
    keys,
    name: `CN=${params.subjectCn}`,
    signingAlgorithm: CSR_SIGNING_ALGORITHM,
  });

  return {
    csrDer: new Uint8Array(csr.rawData),
    privateKey: keys.privateKey,
  };
};

// exportEncryptedKey serializes privateKey as a PBES2 (PBKDF2-HMAC-SHA256 +
// AES-256-CBC) encrypted PKCS#8. It THROWS on a passphrase shorter than the
// 18-character floor: there is no plaintext export path anywhere in the
// module, so a weak passphrase is the only insecure export, and this guard
// closes it.
export const exportEncryptedKey = async (
  privateKey: CryptoKey,
  passphrase: string,
): Promise<Uint8Array> => {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }

  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey));

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-CBC", length: 256 },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-CBC", iv }, aesKey, pkcs8),
  );

  return encodeEncryptedPrivateKeyInfo(salt, PBKDF2_ITERATIONS, iv, ciphertext);
};

// generateStrongPassphrase returns a cryptographically random passphrase well
// above the 18-character floor, drawing from a mixed-class alphabet so the
// generated value is not trivially guessable.
export const generateStrongPassphrase = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+";
  const length = 24;
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
};

// toPemEncryptedKey wraps encrypted PKCS#8 DER in the ENCRYPTED PRIVATE KEY
// PEM armor for download. There is deliberately no plain-PRIVATE-KEY variant.
export const toPemEncryptedKey = (der: Uint8Array): string => {
  const lines = base64(der).match(/.{1,64}/g) ?? [];
  return `-----BEGIN ENCRYPTED PRIVATE KEY-----\n${lines.join("\n")}\n-----END ENCRYPTED PRIVATE KEY-----\n`;
};

// --- Minimal DER encoder for the RFC 5958 / RFC 8018 encrypted PKCS#8
// envelope. Only the shapes this module emits are supported; each helper
// returns a fully-tagged, length-prefixed DER element.

export const derLength = (len: number): Uint8Array => {
  if (len < 0x80) return new Uint8Array([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
};

export const derElement = (tag: number, content: Uint8Array): Uint8Array =>
  concat(new Uint8Array([tag]), derLength(content.length), content);

export const derSequence = (...parts: Uint8Array[]): Uint8Array =>
  derElement(0x30, concat(...parts));
export const derOctetString = (content: Uint8Array): Uint8Array => derElement(0x04, content);
export const derNull = (): Uint8Array => new Uint8Array([0x05, 0x00]);

export const derInteger = (value: number): Uint8Array => {
  const bytes: number[] = [];
  let n = value;
  do {
    bytes.unshift(n & 0xff);
    n >>= 8;
  } while (n > 0);
  // Prepend 0x00 when the top bit is set so the integer stays positive.
  if (bytes[0] & 0x80) bytes.unshift(0x00);
  return derElement(0x02, new Uint8Array(bytes));
};

export const derOid = (oid: string): Uint8Array => {
  const parts = oid.split(".").map(Number);
  const body: number[] = [40 * parts[0] + parts[1]];
  for (const part of parts.slice(2)) {
    const chunk: number[] = [part & 0x7f];
    let v = part >> 7;
    while (v > 0) {
      chunk.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    body.push(...chunk);
  }
  return derElement(0x06, new Uint8Array(body));
};

// EncryptedPrivateKeyInfo ::= SEQUENCE { encryptionAlgorithm, encryptedData }
export const encodeEncryptedPrivateKeyInfo = (
  salt: Uint8Array,
  iterations: number,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array => {
  // PBKDF2-params ::= SEQUENCE { salt, iterationCount, prf AlgorithmIdentifier }
  const pbkdf2Params = derSequence(
    derOctetString(salt),
    derInteger(iterations),
    derSequence(derOid(OID_HMAC_SHA256), derNull()),
  );
  // keyDerivationFunc ::= AlgorithmIdentifier { id-PBKDF2, PBKDF2-params }
  const keyDerivationFunc = derSequence(derOid(OID_PBKDF2), pbkdf2Params);
  // encryptionScheme ::= AlgorithmIdentifier { aes256-CBC, IV }
  const encryptionScheme = derSequence(derOid(OID_AES_256_CBC), derOctetString(iv));
  // PBES2-params ::= SEQUENCE { keyDerivationFunc, encryptionScheme }
  const pbes2Params = derSequence(keyDerivationFunc, encryptionScheme);
  // encryptionAlgorithm ::= AlgorithmIdentifier { id-PBES2, PBES2-params }
  const encryptionAlgorithm = derSequence(derOid(OID_PBES2), pbes2Params);

  return derSequence(encryptionAlgorithm, derOctetString(ciphertext));
};

export const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

export const base64 = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
