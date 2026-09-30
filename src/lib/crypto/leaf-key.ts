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
  ExtendedKeyUsage,
  ExtendedKeyUsageExtension,
  Extension,
  type JsonGeneralName,
  KeyUsageFlags,
  KeyUsagesExtension,
  Pkcs10CertificateRequestGenerator,
  SubjectAlternativeNameExtension,
} from "@peculiar/x509";

import type { OperatorLevel } from "@/lib/operators";

// The leaf keypair is ECDSA P-384, generated in the browser with WebCrypto, and
// the CSR is signed with ECDSA-SHA384 to match the curve. A CryptOS node
// certifies ECDSA subject keys on P-384 only, and the external CAs used for
// operator credentials expect P-384 as well (#138). The private key is
// extractable so it can be exported -- but only ever as a passphrase-encrypted
// PKCS#8, never in plaintext.
const LEAF_KEY_ALGORITHM: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-384" };
const CSR_SIGNING_ALGORITHM: EcdsaParams = { name: "ECDSA", hash: "SHA-384" };

// The 18-character floor is a hard, in-code guard on every export path -- the
// UI never gets to skip it, and there is no plaintext branch to fall back to.
export const MIN_PASSPHRASE_LENGTH = 18;

// PBES2 with PBKDF2 (HMAC-SHA-256) key derivation and AES-256-CBC encryption,
// the RFC 8018 object identifiers for the encrypted-PKCS#8 envelope.
export const OID_PBES2 = "1.2.840.113549.1.5.13";
export const OID_PBKDF2 = "1.2.840.113549.1.5.12";
export const OID_HMAC_SHA256 = "1.2.840.113549.2.9";
export const OID_AES_256_CBC = "2.16.840.1.101.3.4.1.42";

// The Fleet Manager reads an operator's access level from this private
// extension; its value is an ASN.1 PrintableString of the level token.
export const OPERATOR_LEVEL_OID = "1.3.6.1.4.1.59999.1.1";

// Named-curve OIDs a PKCS#8 ECDSA key may carry, mapped to WebCrypto names.
const EC_CURVE_BY_OID: Record<string, "P-256" | "P-384"> = {
  "1.2.840.10045.3.1.7": "P-256",
  "1.3.132.0.34": "P-384",
};
const OID_EC_PUBLIC_KEY = "1.2.840.10045.2.1";

export const PBKDF2_ITERATIONS = 210_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 16;

// OperatorExtensionRequest asks the signing CA for the operator credential
// profile. The CA may honour or ignore it; the Fleet Manager checks the issued
// certificate either way.
export interface OperatorExtensionRequest {
  level: OperatorLevel;
}

// operatorProfileExtensions builds the requested operator profile: the level
// extension (non-critical, because Go's x509.Verify refuses unhandled critical
// extensions on TLS client certs), EKU clientAuth, KU digitalSignature
// (critical) and basicConstraints CA:FALSE (critical).
const operatorProfileExtensions = (request: OperatorExtensionRequest): Extension[] => [
  new Extension(OPERATOR_LEVEL_OID, false, bufferOf(printableString(request.level))),
  new ExtendedKeyUsageExtension([ExtendedKeyUsage.clientAuth]),
  new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
  new BasicConstraintsExtension(false, undefined, true),
];

// generateLeafKeyAndCSR mints an extractable ECDSA P-384 keypair in the
// browser and builds a PKCS#10 CSR carrying the subject CN and, when SANs are
// supplied, a subjectAltName extension. With extensionRequest it also carries
// a PKCS#9 extensionRequest for the operator profile. Only the DER CSR is
// meant to leave the browser; privateKey stays in memory for the caller to
// export on demand.
export const generateLeafKeyAndCSR = async (params: {
  extensionRequest?: OperatorExtensionRequest;
  keyAlg?: "ECDSA-P384";
  sans: string[];
  subjectCn: string;
}): Promise<{ csrDer: Uint8Array; privateKey: CryptoKey }> => {
  const keys = await crypto.subtle.generateKey(LEAF_KEY_ALGORITHM, true, ["sign", "verify"]);

  const sans = params.sans.map((s) => s.trim()).filter(Boolean);
  const sanNames: JsonGeneralName[] = sans.map((value) => ({ type: "dns", value }));
  const extensions: Extension[] =
    sanNames.length > 0 ? [new SubjectAlternativeNameExtension(sanNames)] : [];
  if (params.extensionRequest) {
    extensions.push(...operatorProfileExtensions(params.extensionRequest));
  }

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

// importEncryptedKey is the inverse of exportEncryptedKey: it decrypts a PBES2
// (PBKDF2-HMAC-SHA256 + AES-256-CBC) encrypted PKCS#8 with WebCrypto alone and
// imports the ECDSA key as an extractable signing key, so it can go into a
// PKCS#12. A wrong passphrase and a damaged file fail with the same message:
// AES-CBC padding alone can't tell them apart.
export const importEncryptedKey = async (
  encrypted: Uint8Array,
  passphrase: string,
): Promise<CryptoKey> => {
  const { ciphertext, iterations, iv, salt } = decodeEncryptedPrivateKeyInfo(encrypted);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bufferOf(salt), iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-CBC", length: 256 },
    false,
    ["decrypt"],
  );

  try {
    const pkcs8 = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-CBC", iv: bufferOf(iv) },
        aesKey,
        bufferOf(ciphertext),
      ),
    );
    return await crypto.subtle.importKey(
      "pkcs8",
      bufferOf(pkcs8),
      { name: "ECDSA", namedCurve: pkcs8Curve(pkcs8) },
      true,
      ["sign"],
    );
  } catch {
    throw new Error("The passphrase is wrong or the key file is damaged.");
  }
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

// --- Minimal DER reader, the inverse of the encoder above: definite lengths
// and low tag numbers only, which covers every shape this module reads.

interface Tlv {
  content: Uint8Array;
  tag: number;
}

const readTlv = (bytes: Uint8Array, offset: number): { next: number; tlv: Tlv } => {
  if (offset + 2 > bytes.length) throw new Error("truncated DER");
  const tag = bytes[offset];
  let len = bytes[offset + 1];
  let start = offset + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error("unsupported DER length");
    len = 0;
    for (let k = 0; k < n; k += 1) len = len * 256 + bytes[start + k];
    start += n;
  }
  if (start + len > bytes.length) throw new Error("truncated DER");
  return { next: start + len, tlv: { content: bytes.subarray(start, start + len), tag } };
};

const derChildren = (content: Uint8Array): Tlv[] => {
  const out: Tlv[] = [];
  let offset = 0;
  while (offset < content.length) {
    const { next, tlv } = readTlv(content, offset);
    out.push(tlv);
    offset = next;
  }
  return out;
};

const expectTag = (tlv: Tlv | undefined, tag: number): Tlv => {
  if (!tlv || tlv.tag !== tag) throw new Error("unexpected DER structure");
  return tlv;
};

const decodeOid = (content: Uint8Array): string => {
  const parts: number[] = [Math.floor(content[0] / 40), content[0] % 40];
  let v = 0;
  for (const b of content.subarray(1)) {
    v = v * 128 + (b & 0x7f);
    if (!(b & 0x80)) {
      parts.push(v);
      v = 0;
    }
  }
  return parts.join(".");
};

const oidOf = (tlv: Tlv | undefined): string => decodeOid(expectTag(tlv, 0x06).content);

// decodeEncryptedPrivateKeyInfo reads the envelope encodeEncryptedPrivateKeyInfo
// writes and refuses any other scheme, PRF or cipher.
const decodeEncryptedPrivateKeyInfo = (
  der: Uint8Array,
): { ciphertext: Uint8Array; iterations: number; iv: Uint8Array; salt: Uint8Array } => {
  try {
    const [algorithm, encryptedData] = derChildren(expectTag(readTlv(der, 0).tlv, 0x30).content);
    const [schemeOid, pbes2Params] = derChildren(expectTag(algorithm, 0x30).content);
    if (oidOf(schemeOid) !== OID_PBES2) throw new Error("not PBES2");
    const [kdf, scheme] = derChildren(expectTag(pbes2Params, 0x30).content);

    const [kdfOid, kdfParams] = derChildren(expectTag(kdf, 0x30).content);
    if (oidOf(kdfOid) !== OID_PBKDF2) throw new Error("not PBKDF2");
    const [salt, iterationCount, prf] = derChildren(expectTag(kdfParams, 0x30).content);
    if (oidOf(derChildren(expectTag(prf, 0x30).content)[0]) !== OID_HMAC_SHA256) {
      throw new Error("not HMAC-SHA256");
    }
    let iterations = 0;
    for (const b of expectTag(iterationCount, 0x02).content) iterations = iterations * 256 + b;
    if (iterations < 1) throw new Error("bad iteration count");

    const [cipherOid, iv] = derChildren(expectTag(scheme, 0x30).content);
    if (oidOf(cipherOid) !== OID_AES_256_CBC) throw new Error("not AES-256-CBC");
    if (expectTag(iv, 0x04).content.length !== IV_BYTES) throw new Error("bad IV");

    return {
      ciphertext: expectTag(encryptedData, 0x04).content,
      iterations,
      iv: iv.content,
      salt: expectTag(salt, 0x04).content,
    };
  } catch {
    throw new Error(
      "Not a supported encrypted private key (expected PBES2 with PBKDF2-HMAC-SHA256 and AES-256-CBC).",
    );
  }
};

// pkcs8Curve reads the named curve from a PKCS#8 ECDSA key's
// AlgorithmIdentifier, since WebCrypto's importKey needs it up front.
const pkcs8Curve = (pkcs8: Uint8Array): "P-256" | "P-384" => {
  const [, algorithm] = derChildren(expectTag(readTlv(pkcs8, 0).tlv, 0x30).content);
  const [keyOid, curveOid] = derChildren(expectTag(algorithm, 0x30).content);
  const curve = EC_CURVE_BY_OID[oidOf(curveOid)];
  if (oidOf(keyOid) !== OID_EC_PUBLIC_KEY || !curve) throw new Error("unsupported key");
  return curve;
};

const printableString = (value: string): Uint8Array =>
  derElement(0x13, new TextEncoder().encode(value));

const bufferOf = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
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
