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
  Pkcs10CertificateRequest,
  SubjectAlternativeNameExtension,
} from "@peculiar/x509";

// Parsing a pasted PKCS#10, for the case the browser did not generate the key:
// an appliance did. VMware VMCA and Microsoft AD CS both generate their own key
// and expose no algorithm choice, so an operator subordinating one arrives
// holding a CSR rather than wanting one made for them (#88).

export interface ParsedCsr {
  /** DER bytes to send to IssueLeaf. */
  csrDer: Uint8Array;
  /** Human-readable key description, e.g. "RSA 3072" or "ECDSA P-384". */
  keyDescription: string;
  /** RSA modulus size, when the subject key is RSA. */
  keyBits?: number;
  sans: string[];
  subjectCn: string;
  /** The full subject DN, for the cases where the CN alone is not enough. */
  subjectDn: string;
}

/**
 * parseCsr reads a pasted PKCS#10 and describes what it asks for, so the
 * operator sees the subject, the SANs and the key before anything is signed.
 *
 * The signature is verified. A PKCS#10 is self-signed by the requesting key, so
 * a bad signature means the paste is truncated or the request does not
 * correspond to its own key -- either way it should be refused here rather than
 * by the node, where the error is further from the person who can fix it.
 */
export const parseCsr = async (input: string): Promise<ParsedCsr> => {
  const trimmed = input.trim();
  if (trimmed === "") {
    throw new Error("Paste a PKCS#10 certificate signing request.");
  }

  let csr: Pkcs10CertificateRequest;
  try {
    csr = new Pkcs10CertificateRequest(trimmed);
  } catch {
    throw new Error(
      "That is not a PKCS#10 request. Expected a PEM block beginning -----BEGIN CERTIFICATE REQUEST-----.",
    );
  }

  if (!(await csr.verify())) {
    throw new Error(
      "The request's signature does not verify. The paste may be truncated, or the key does not match the request.",
    );
  }

  const cn = csr.subjectName.getField("CN")[0] ?? "";
  if (cn === "") {
    throw new Error("The request has no common name in its subject.");
  }

  return {
    csrDer: new Uint8Array(csr.rawData),
    ...describeKey(await csr.publicKey.export()),
    sans: sansOf(csr),
    subjectCn: cn,
    subjectDn: csr.subject,
  };
};

const describeKey = (key: CryptoKey): { keyBits?: number; keyDescription: string } => {
  const algorithm = key.algorithm as EcKeyAlgorithm & RsaKeyAlgorithm;

  if (algorithm.name.startsWith("RSA")) {
    return {
      keyBits: algorithm.modulusLength,
      keyDescription: `RSA ${algorithm.modulusLength}`,
    };
  }
  if (algorithm.namedCurve) {
    return { keyDescription: `ECDSA ${algorithm.namedCurve}` };
  }

  return { keyDescription: algorithm.name };
};

// id-ce-subjectAltName (RFC 5280 4.2.1.6). getExtension takes the OID and
// returns a generic Extension, so the SAN view is constructed over its bytes.
const OID_SUBJECT_ALT_NAME = "2.5.29.17";

const sansOf = (csr: Pkcs10CertificateRequest): string[] => {
  const extension = csr.getExtension(OID_SUBJECT_ALT_NAME);
  if (!extension) return [];

  const san = new SubjectAlternativeNameExtension(extension.rawData);

  return san.names.toJSON().map((n: JsonGeneralName) => n.value);
};
