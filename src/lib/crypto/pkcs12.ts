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

import {
  base64,
  concat,
  derElement,
  derInteger,
  derNull,
  derOctetString,
  derOid,
  derSequence,
  encodeEncryptedPrivateKeyInfo,
  IV_BYTES,
  MIN_PASSPHRASE_LENGTH,
  PBKDF2_ITERATIONS,
  SALT_BYTES,
} from "@/lib/crypto/leaf-key";

// bufferOf returns an ArrayBuffer-backed copy of the bytes so WebCrypto's
// BufferSource-typed parameters accept it regardless of the source view's
// backing store (a plain Uint8Array can be SharedArrayBuffer-backed in the DOM
// lib types).
const bufferOf = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
};

// This module assembles a passphrase-protected PKCS#12 (RFC 7292) in the
// browser from a certificate the operator-CA node just signed and the private
// key the browser minted for the operator credential. The key never leaves the
// browser in plaintext: it is PBES2-shrouded (the same PBKDF2-HMAC-SHA256 +
// AES-256-CBC envelope leaf-key already uses for encrypted PKCS#8) before it is
// placed in a shrouded-key SafeBag, and the whole authenticated safe is sealed
// with an HMAC-SHA256 MacData keyed through the RFC 7292 password KDF. The
// output is standard enough for OpenSSL and the platform keystores to import.
//
// The passphrase is never logged and never rendered back; the >= 18-character
// floor is enforced here (as in every other export path) before any bytes are
// produced.

// PKCS#12 / PKCS#9 object identifiers used to name the bags and safe contents.
const OID_DATA = "1.2.840.113549.1.7.1";
const OID_PKCS12_PKCS8_SHROUDED_KEY_BAG = "1.2.840.113549.1.12.10.1.2";
const OID_PKCS12_CERT_BAG = "1.2.840.113549.1.12.10.1.3";
const OID_PKCS9_X509_CERTIFICATE = "1.2.840.113549.1.9.22.1";
const OID_SHA256 = "2.16.840.1.101.3.4.2.1";

const MAC_ITERATIONS = 210_000;
const MAC_SALT_BYTES = 16;

// derContextExplicit wraps content in an explicit context-specific [n] tag
// (constructed), the shape the SafeBag bagValue and PFX authSafe content use.
const derContextExplicit = (n: number, content: Uint8Array): Uint8Array =>
  derElement(0xa0 | n, content);

// exportShroudedPkcs8 exports the private key as a PBES2 encrypted PKCS#8 --
// the exact encrypted-PrivateKeyInfo leaf-key produces for its PEM export, so a
// single reviewed envelope encoder covers both surfaces.
const exportShroudedPkcs8 = async (
  privateKey: CryptoKey,
  passphrase: string,
): Promise<Uint8Array> => {
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

// safeBag builds one SafeBag ::= SEQUENCE { bagId OID, bagValue [0] EXPLICIT
// ANY }. bagAttributes are omitted (they are optional and unnecessary here).
const safeBag = (bagId: string, bagValue: Uint8Array): Uint8Array =>
  derSequence(derOid(bagId), derContextExplicit(0, bagValue));

// certBag wraps the DER certificate as a CertBag ::= SEQUENCE { certId OID,
// certValue [0] EXPLICIT OCTET STRING }.
const certBag = (certDer: Uint8Array): Uint8Array =>
  derSequence(derOid(OID_PKCS9_X509_CERTIFICATE), derContextExplicit(0, derOctetString(certDer)));

// contentInfoData wraps content in a ContentInfo of type id-data, where the
// content is an OCTET STRING carrying the DER of the SafeContents SEQUENCE.
const contentInfoData = (safeContentsDer: Uint8Array): Uint8Array =>
  derSequence(derOid(OID_DATA), derContextExplicit(0, derOctetString(safeContentsDer)));

// The RFC 7292 Appendix B key-derivation function, specialized to SHA-256 (the
// modern PKCS#12 MAC PRF). It derives the MAC key from the passphrase, the salt
// and the iteration count. id (=3) selects MAC-key material.
const HASH_LEN = 32; // SHA-256
const HASH_BLOCK = 64; // v for SHA-256

const bmpString = (s: string): Uint8Array => {
  // PKCS#12 passwords are BMPString (UTF-16BE) with a trailing double-null.
  const out = new Uint8Array((s.length + 1) * 2);
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    out[i * 2] = (code >> 8) & 0xff;
    out[i * 2 + 1] = code & 0xff;
  }
  return out;
};

const fillRepeated = (source: Uint8Array, length: number): Uint8Array => {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) out[i] = source[i % source.length];
  return out;
};

// A compact, synchronous SHA-256 for the PKCS#12 KDF inner loop. WebCrypto's
// digest is async, and the KDF hashes tens of thousands of times; issuing that
// many awaited round-trips is prohibitively slow, so the KDF uses this pure
// function instead. It is used ONLY for the integrity MAC KDF -- the private
// key itself is sealed by WebCrypto's PBKDF2 + AES.
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

const sha256Sync = (msg: Uint8Array): Uint8Array => {
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const bitLen = msg.length * 8;
  const withOne = msg.length + 1;
  const padded = new Uint8Array(Math.ceil((withOne + 8) / 64) * 64);
  padded.set(msg);
  padded[msg.length] = 0x80;
  // 64-bit big-endian length in the final 8 bytes (message length fits in 32 bits here).
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));

  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) odv.setUint32(i * 4, h[i]);
  return out;
};

const pkcs12Kdf = (
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  idByte: number,
): Uint8Array => {
  const pw = bmpString(passphrase);
  const D = new Uint8Array(HASH_BLOCK).fill(idByte);
  const S = fillRepeated(salt, Math.ceil(salt.length / HASH_BLOCK) * HASH_BLOCK || HASH_BLOCK);
  const P = fillRepeated(pw, Math.ceil(pw.length / HASH_BLOCK) * HASH_BLOCK || HASH_BLOCK);
  const I = concat(S, P);

  // Only one block of output is needed: SHA-256 already yields the full 32-byte
  // MAC key, so the outer "generate n blocks" loop of Appendix B collapses to a
  // single block. Ai = H(H(...H(D||I))) applied `iterations` times: the first
  // hash covers D||I, each subsequent hash covers the previous 32-byte digest.
  let A = sha256Sync(concat(D, I));
  for (let i = 1; i < iterations; i += 1) {
    A = sha256Sync(A);
  }
  return A.slice(0, HASH_LEN);
};

// macData builds MacData ::= SEQUENCE { mac DigestInfo, macSalt OCTET STRING,
// iterations INTEGER } over the authSafe content, using HMAC-SHA256 keyed by
// the PKCS#12 KDF (id = 3, MAC material).
const buildMacData = async (
  authSafeContent: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> => {
  const macSalt = crypto.getRandomValues(new Uint8Array(MAC_SALT_BYTES));
  const macKey = pkcs12Kdf(passphrase, macSalt, MAC_ITERATIONS, 3);
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    bufferOf(macKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, bufferOf(authSafeContent)));

  // DigestInfo ::= SEQUENCE { digestAlgorithm AlgorithmIdentifier, digest OCTET STRING }
  const digestInfo = derSequence(derSequence(derOid(OID_SHA256), derNull()), derOctetString(mac));
  return derSequence(digestInfo, derOctetString(macSalt), derInteger(MAC_ITERATIONS));
};

// assemblePkcs12 produces a passphrase-protected PKCS#12 (.p12) carrying the
// operator's certificate and its PBES2-shrouded private key. It THROWS on a
// passphrase below the shared floor, matching every other browser export path.
export const assemblePkcs12 = async (
  certDer: Uint8Array,
  privateKey: CryptoKey,
  passphrase: string,
): Promise<Uint8Array> => {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }

  // Key SafeContents: one shrouded-key bag holding the encrypted PKCS#8.
  const shroudedPkcs8 = await exportShroudedPkcs8(privateKey, passphrase);
  const keyBag = safeBag(OID_PKCS12_PKCS8_SHROUDED_KEY_BAG, shroudedPkcs8);
  const keySafeContents = derSequence(keyBag);

  // Cert SafeContents: one cert bag holding the DER certificate.
  const certSafeBag = safeBag(OID_PKCS12_CERT_BAG, certBag(certDer));
  const certSafeContents = derSequence(certSafeBag);

  // AuthenticatedSafe ::= SEQUENCE OF ContentInfo. Both bag groups are carried
  // as plaintext id-data ContentInfos; the private key is already PBES2-sealed
  // inside its bag, so a separate encrypted-data ContentInfo is not required.
  const authenticatedSafe = derSequence(
    contentInfoData(keySafeContents),
    contentInfoData(certSafeContents),
  );

  // authSafe is a ContentInfo of type id-data wrapping the AuthenticatedSafe;
  // the MAC is computed over the inner OCTET STRING content (the DER of the
  // AuthenticatedSafe), per RFC 7292.
  const authSafe = contentInfoData(authenticatedSafe);
  const macData = await buildMacData(authenticatedSafe, passphrase);

  // PFX ::= SEQUENCE { version INTEGER (3), authSafe ContentInfo, macData MacData }
  return derSequence(derInteger(3), authSafe, macData);
};

// toBase64Pkcs12 is a convenience for callers that need the .p12 as base64
// (for example an attachment or a data URL); the download path uses the raw
// bytes directly.
export const toBase64Pkcs12 = (pfx: Uint8Array): string => base64(pfx);
