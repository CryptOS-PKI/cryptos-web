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
import { X509Certificate } from "@peculiar/x509";

import { exportEncryptedKey, importEncryptedKey, toPemEncryptedKey } from "@/lib/crypto/leaf-key";
import { assemblePkcs12 } from "@/lib/crypto/pkcs12";

// The operator's key backup: the browser-made private key as an encrypted
// PKCS#8 file (PBES2, PBKDF2-HMAC-SHA256 and AES-256-CBC), saved to the
// operator's disk before the CSR is shown. The external CA can take a day to
// sign, and a reload or an expired session must not lose the key. The same
// passphrase later protects the PKCS#12, so the operator keeps one secret. The
// key never goes to the Fleet Manager in any form.

// 64 symbols, so each random byte maps to one without modulo bias: 24 of them
// carry 144 bits.
export const BACKUP_PASSPHRASE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BACKUP_PASSPHRASE_LENGTH = 24;

export const generateBackupPassphrase = (): string => {
  let out = "";
  for (const b of crypto.getRandomValues(new Uint8Array(BACKUP_PASSPHRASE_LENGTH))) {
    out += BACKUP_PASSPHRASE_ALPHABET[b & 63];
  }
  return out;
};

export const keyBackupFilename = (level: string, email: string): string =>
  `fleetos-${level}-${email.trim().toLowerCase()}.key.pem`;

export const keyBackupPem = async (privateKey: CryptoKey, passphrase: string): Promise<string> =>
  toPemEncryptedKey(await exportEncryptedKey(privateKey, passphrase));

const pemBody = (text: string, label: string): Uint8Array | undefined => {
  const match = new RegExp(`-----BEGIN ${label}-----([^-]+)-----END ${label}-----`).exec(text);
  if (!match) return undefined;
  const b64 = match[1].replaceAll(/\s/g, "");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

const looksLikePem = (bytes: Uint8Array): boolean => bytes.length > 0 && bytes[0] !== 0x30;

// readKeyBackup loads a key backup file (PEM or DER) with its passphrase.
export const readKeyBackup = async (file: Uint8Array, passphrase: string): Promise<CryptoKey> => {
  let der = file;
  if (looksLikePem(file)) {
    const body = pemBody(new TextDecoder().decode(file), "ENCRYPTED PRIVATE KEY");
    if (!body) {
      throw new Error(
        "That file is not a key backup. Expected a PEM block beginning -----BEGIN ENCRYPTED PRIVATE KEY-----.",
      );
    }
    der = body;
  }
  return importEncryptedKey(der, passphrase);
};

// readCertificateDer accepts a certificate as PEM or DER and returns its DER.
export const readCertificateDer = (file: Uint8Array): Uint8Array => {
  try {
    const cert = looksLikePem(file)
      ? new X509Certificate(new TextDecoder().decode(file).trim())
      : new X509Certificate(new Uint8Array(file));
    return new Uint8Array(cert.rawData);
  } catch {
    throw new Error(
      "That is not a certificate. Expected PEM (-----BEGIN CERTIFICATE-----) or DER.",
    );
  }
};

const publicPoint = async (key: CryptoKey): Promise<string> => {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return `${jwk.crv}:${jwk.x}:${jwk.y}`;
};

// keyMatchesCertificate checks that the certificate carries the public half of
// the private key, so a PKCS#12 is never built from a mismatched pair.
export const keyMatchesCertificate = async (
  privateKey: CryptoKey,
  certDer: Uint8Array,
): Promise<boolean> => {
  try {
    const cert = new X509Certificate(new Uint8Array(certDer));
    const publicKey = await cert.publicKey.export();
    return (await publicPoint(publicKey)) === (await publicPoint(privateKey));
  } catch {
    return false;
  }
};

// buildCredentialPkcs12 opens the key backup with its passphrase and seals the
// PKCS#12 with that same passphrase: the leaf, then the chain (the operator CA).
export const buildCredentialPkcs12 = async (params: {
  backup: Uint8Array;
  certDer: Uint8Array;
  chainDer: Uint8Array[];
  friendlyName: string;
  passphrase: string;
}): Promise<Uint8Array> => {
  const key = await readKeyBackup(params.backup, params.passphrase);
  if (!(await keyMatchesCertificate(key, params.certDer))) {
    throw new Error(
      "The certificate does not match the key in this backup. Check that it was signed from this key's CSR.",
    );
  }
  return assemblePkcs12(params.certDer, key, params.passphrase, params.chainDer, {
    friendlyName: params.friendlyName,
  });
};
