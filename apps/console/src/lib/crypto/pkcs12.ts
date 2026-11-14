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
// browser from a certificate the external operator CA signed and the private
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
const OID_PKCS9_FRIENDLY_NAME = "1.2.840.113549.1.9.20";
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
    { hash: "SHA-256", iterations: PBKDF2_ITERATIONS, name: "PBKDF2", salt },
    baseKey,
    { length: 256, name: "AES-CBC" },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ iv, name: "AES-CBC" }, aesKey, pkcs8),
  );
  return encodeEncryptedPrivateKeyInfo(salt, PBKDF2_ITERATIONS, iv, ciphertext);
};

// safeBag builds one SafeBag ::= SEQUENCE { bagId OID, bagValue [0] EXPLICIT
// ANY, bagAttributes SET OF Attribute OPTIONAL }. The only attribute used is
// the PKCS#9 friendlyName, which keystores show as the certificate's label.
const safeBag = (bagId: string, bagValue: Uint8Array, friendlyName?: string): Uint8Array =>
  friendlyName
    ? derSequence(
        derOid(bagId),
        derContextExplicit(0, bagValue),
        derElement(
          0x31,
          derSequence(
            derOid(OID_PKCS9_FRIENDLY_NAME),
            derElement(0x31, derElement(0x1e, bmpString(friendlyName).slice(0, -2))),
          ),
        ),
      )
    : derSequence(derOid(bagId), derContextExplicit(0, bagValue));

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
  0x42_8a_2f_98, 0x71_37_44_91, 0xb5_c0_fb_cf, 0xe9_b5_db_a5, 0x39_56_c2_5b, 0x59_f1_11_f1,
  0x92_3f_82_a4, 0xab_1c_5e_d5, 0xd8_07_aa_98, 0x12_83_5b_01, 0x24_31_85_be, 0x55_0c_7d_c3,
  0x72_be_5d_74, 0x80_de_b1_fe, 0x9b_dc_06_a7, 0xc1_9b_f1_74, 0xe4_9b_69_c1, 0xef_be_47_86,
  0x0f_c1_9d_c6, 0x24_0c_a1_cc, 0x2d_e9_2c_6f, 0x4a_74_84_aa, 0x5c_b0_a9_dc, 0x76_f9_88_da,
  0x98_3e_51_52, 0xa8_31_c6_6d, 0xb0_03_27_c8, 0xbf_59_7f_c7, 0xc6_e0_0b_f3, 0xd5_a7_91_47,
  0x06_ca_63_51, 0x14_29_29_67, 0x27_b7_0a_85, 0x2e_1b_21_38, 0x4d_2c_6d_fc, 0x53_38_0d_13,
  0x65_0a_73_54, 0x76_6a_0a_bb, 0x81_c2_c9_2e, 0x92_72_2c_85, 0xa2_bf_e8_a1, 0xa8_1a_66_4b,
  0xc2_4b_8b_70, 0xc7_6c_51_a3, 0xd1_92_e8_19, 0xd6_99_06_24, 0xf4_0e_35_85, 0x10_6a_a0_70,
  0x19_a4_c1_16, 0x1e_37_6c_08, 0x27_48_77_4c, 0x34_b0_bc_b5, 0x39_1c_0c_b3, 0x4e_d8_aa_4a,
  0x5b_9c_ca_4f, 0x68_2e_6f_f3, 0x74_8f_82_ee, 0x78_a5_63_6f, 0x84_c8_78_14, 0x8c_c7_02_08,
  0x90_be_ff_fa, 0xa4_50_6c_eb, 0xbe_f9_a3_f7, 0xc6_71_78_f2,
];

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

const sha256Sync = (msg: Uint8Array): Uint8Array => {
  const h = [
    0x6a_09_e6_67, 0xbb_67_ae_85, 0x3c_6e_f3_72, 0xa5_4f_f5_3a, 0x51_0e_52_7f, 0x9b_05_68_8c,
    0x1f_83_d9_ab, 0x5b_e0_cd_19,
  ];
  const bitLen = msg.length * 8;
  const withOne = msg.length + 1;
  const padded = new Uint8Array(Math.ceil((withOne + 8) / 64) * 64);
  padded.set(msg);
  padded[msg.length] = 0x80;
  // 64-bit big-endian length in the final 8 bytes (message length fits in 32 bits here).
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x1_00_00_00_00));

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
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, bufferOf(authSafeContent)));

  // DigestInfo ::= SEQUENCE { digestAlgorithm AlgorithmIdentifier, digest OCTET STRING }
  const digestInfo = derSequence(derSequence(derOid(OID_SHA256), derNull()), derOctetString(mac));
  return derSequence(digestInfo, derOctetString(macSalt), derInteger(MAC_ITERATIONS));
};

// assemblePkcs12 produces a passphrase-protected PKCS#12 (.p12) carrying the
// operator's certificate, its PBES2-shrouded private key and, when given, the
// chain certificates (for example the operator CA anchor) after the leaf. It
// THROWS on a passphrase below the shared floor, matching every other browser
// export path.
export const assemblePkcs12 = async (
  certDer: Uint8Array,
  privateKey: CryptoKey,
  passphrase: string,
  chainDer: Uint8Array[] = [],
  options: { friendlyName?: string } = {},
): Promise<Uint8Array> => {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }

  // Key SafeContents: one shrouded-key bag holding the encrypted PKCS#8.
  const shroudedPkcs8 = await exportShroudedPkcs8(privateKey, passphrase);
  const keyBag = safeBag(OID_PKCS12_PKCS8_SHROUDED_KEY_BAG, shroudedPkcs8, options.friendlyName);
  const keySafeContents = derSequence(keyBag);

  // Cert SafeContents: the leaf's cert bag first, then one per chain cert.
  const certSafeContents = derSequence(
    safeBag(OID_PKCS12_CERT_BAG, certBag(certDer), options.friendlyName),
    ...chainDer.map((der) => safeBag(OID_PKCS12_CERT_BAG, certBag(der))),
  );

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
