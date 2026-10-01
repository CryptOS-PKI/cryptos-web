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

import { errorCode, errorReason } from "@/lib/fleet/error-code";

// What to tell the operator for each first-run, operator-CA and operator
// credential refusal (codes 1600-1611), and for the refusals a LINK
// enrollment can meet (1100, 1102, 1106, 1107). Branch on the code and sub-reason the
// manager attaches, never on its message text. A sub-reason name can appear
// under more than one code (KEY_TYPE, EXPIRING, SUBJECT_MISMATCH,
// DATABASE_REQUIRED), so reason copy is keyed by "<code>/<REASON>".

export interface FleetErrorCopy {
  code?: number;
  detail: string;
  reason?: string;
  title: string;
}

const CODE_COPY: Record<number, { detail: string; title: string }> = {
  1100: {
    detail:
      "The Fleet Manager could not reach the node at that endpoint. Check the address and port, and that the node is running.",
    title: "Node unreachable",
  },
  1102: {
    detail:
      "Another node in the inventory already has the name this node would get. Rename that node, then approve again.",
    title: "Node name taken",
  },
  1106: {
    detail:
      "The node's management certificate did not verify against the CA you gave. Paste the CA certificate that signed the node's management certificate (cryptosctl identity show -o pem prints the chain), or the node's exact management certificate, and check the endpoint is the node's.",
    title: "Node certificate not verified",
  },
  1107: {
    detail:
      "A link needs the CA certificate that signed the node's management certificate, or the node's exact management certificate, so the Fleet Manager can check it is talking to the node.",
    title: "CA certificate required",
  },
  1600: {
    detail:
      "The bootstrap token is wrong, expired or already used. Each token works once: take the newest one from the Fleet Manager's log and try again.",
    title: "Bootstrap token not accepted",
  },
  1601: {
    detail:
      "An admin certificate has already signed in, so first run is over. Sign in with your operator certificate instead.",
    title: "First run is closed",
  },
  1602: {
    detail: "Too many failed attempts from this client. Wait a few minutes before trying again.",
    title: "Too many attempts",
  },
  1603: {
    detail: "This Fleet Manager can't do that in its current configuration.",
    title: "Not available here",
  },
  1604: {
    detail:
      "The first-run session is unknown, expired or ended (a newer session replaces it). Start again with the newest bootstrap token from the log.",
    title: "First-run session ended",
  },
  1605: {
    detail: "The operator CA certificate, or its CRL or OCSP settings, were refused.",
    title: "Operator CA refused",
  },
  1606: {
    detail: "The certificate signing request was refused.",
    title: "CSR refused",
  },
  1607: {
    detail:
      "The operator CA comes from the Fleet Manager's config file (operatorCAPath), so it can't be changed here. Change the config instead.",
    title: "Operator CA managed by config",
  },
  1608: {
    detail: "The Fleet Manager has no fresh revocation data for this certificate.",
    title: "No fresh revocation data",
  },
  1609: {
    detail:
      "Retiring this operator CA would leave no trusted active CA, and nobody could sign in. Register its replacement first.",
    title: "Operator CA still in use",
  },
  1610: {
    detail: "The operator certificate was refused.",
    title: "Certificate refused",
  },
  1611: {
    detail: "The credential request can't be used.",
    title: "Credential request unusable",
  },
};

const REASON_COPY: Record<string, string> = {
  "1603/DATABASE_REQUIRED":
    "This needs Postgres (database_url), which this Fleet Manager runs without. First run and the Fleet Manager denylist keep their state there. Configure the operator CA with operatorCAPath, and revoke at the CA with a CRL.",
  "1603/FIRST_RUN_DISABLED":
    "First run is switched off (firstRun: disabled). Configure the operator CA with operatorCAPath.",

  "1605/NOT_A_CA":
    "The certificate isn't a CA: it needs basicConstraints CA:TRUE and key usage keyCertSign.",
  "1605/EXPIRING":
    "The CA certificate has less than 30 days left. Use a CA with a longer validity.",
  "1605/KEY_TYPE": "The CA key must be ECDSA P-384 or P-256, or RSA of 3072 bits or more.",
  "1605/IS_NODE_CA":
    "That is a CryptOS node's CA. A CryptOS node can never be the operator CA; use an external CA such as an offline OpenSSL CA.",
  "1605/CRL_SIGN_MISSING":
    "A CRL source is set, but the CA's key usage lacks cRLSign, so its CRLs can't be verified. Reissue the CA with cRLSign, or choose no CRL.",
  "1605/NO_CRL_NOT_ACKNOWLEDGED":
    "Choosing no CRL needs the acknowledgement that revocations made at the CA won't be seen and MCP will be refused.",
  "1605/CRL_UNREACHABLE":
    "The Fleet Manager couldn't fetch the CRL from that URL. Check the URL and that the Fleet Manager can reach it.",
  "1605/CRL_INVALID":
    "The CRL failed verification against the CA: check that this CA signed it and that it has a nextUpdate.",
  "1605/CRL_ROLLBACK":
    "That CRL is older than the one the Fleet Manager holds. Publish or upload a newer CRL.",
  "1605/OCSP_UNREACHABLE":
    "The OCSP responder didn't answer the probe. Check the URL and that the responder is running.",
  "1605/OCSP_INVALID":
    "The OCSP responder answered, but its response failed validation (signer, EKU OCSPSigning, validity or format).",
  "1605/NOT_CONFIRMED":
    "The fingerprint wasn't confirmed, or doesn't match the CA. Compare it with the CA certificate and confirm again.",
  "1605/ROTATION_IN_PROGRESS":
    "A retiring operator CA already exists. Retire it before registering another CA.",

  "1606/SIZE": "The CSR is larger than 4 KiB.",
  "1606/SIGNATURE":
    "The CSR's signature doesn't verify. It may be truncated, or not match its own key.",
  "1606/SUBJECT_MISMATCH":
    "The CSR's subject must be exactly one common name, the holder's email (CN=<email>).",
  "1606/KEY_TYPE": "The CSR key must be ECDSA P-384 or RSA of 3072 bits or more.",

  "1608/STALE_CRL": "The operator CA's CRL is past its nextUpdate. Publish or upload a new CRL.",
  "1608/STALE_OCSP":
    "OCSP is configured for this certificate, but the responder gave no fresh answer and there is no fresh CRL to fall back on.",
  "1608/STALE_DENYLIST":
    "This Fleet Manager hasn't read its denylist for over 5 minutes (is Postgres reachable?).",
  "1608/NO_CRL":
    "MCP needs a CRL: this certificate's operator CA has no CRL source. Set one on the Operator CAs page.",
  "1608/DATABASE_REQUIRED":
    "The Fleet Manager denylist needs Postgres, which this Fleet Manager runs without. Revoke at the CA and publish a CRL instead.",

  "1610/NOT_CHAINED":
    "The certificate doesn't verify against the operator CA for client authentication (wrong CA, expired, or an unknown critical extension).",
  "1610/NOT_ACTIVE_ANCHOR":
    "The certificate chains to a retiring operator CA. New credentials must come from the active CA.",
  "1610/WRONG_LEVEL":
    "The level extension (1.3.6.1.4.1.59999.1.1) is missing or names the wrong level. Sign with the matching op_<level> section.",
  "1610/LEVEL_EXT_CRITICAL":
    "The level extension is marked critical. It must be non-critical, or browsers can't sign in with it.",
  "1610/EKU": "The extended key usage must be exactly clientAuth.",
  "1610/KEY_USAGE":
    "The key usage must include digitalSignature, and must not include keyCertSign or cRLSign.",
  "1610/BASIC_CONSTRAINTS": "basicConstraints must be present and CA:FALSE.",
  "1610/SUBJECT_MISMATCH":
    "The certificate's subject must be exactly one common name, the holder's email (CN=<email>).",
  "1610/KEY_TYPE": "The certificate key must be ECDSA P-384 or RSA of 3072 bits or more.",
  "1610/KEY_MISMATCH":
    "The certificate's public key differs from the request's. Upload the certificate signed from this request's CSR.",
  "1610/EXPIRING": "The certificate has less than 1 day left.",
  "1610/REVOKED": "The certificate is on the Fleet Manager denylist or in the CA's CRL.",
  "1610/REVOKED_OCSP": "The operator CA's OCSP responder says this certificate is revoked.",
  "1610/OCSP_UNKNOWN":
    "The operator CA's OCSP responder doesn't know this certificate, which counts as revoked.",
  "1610/DUPLICATE": "This certificate is already recorded.",
  "1610/FULL_NAME": "The full name must be 1 to 128 characters, with no control characters.",

  "1611/NOT_FOUND": "No credential request has that id.",
  "1611/EXPIRED": "The credential request has expired (after 30 days). Make a new request.",
  "1611/NOT_PENDING": "The credential request was already completed or cancelled.",
};

const plainMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message !== "" ? error.message : fallback;

// describeFleetError turns a refusal into a title and a detail. Anything
// without a code listed above keeps its own message.
export const describeFleetError = (
  error: unknown,
  fallback = "The request failed.",
): FleetErrorCopy => {
  const code = errorCode(error);
  const copy = code === undefined ? undefined : CODE_COPY[code];
  if (code === undefined || copy === undefined) {
    return { detail: plainMessage(error, fallback), title: "Request failed" };
  }
  const reason = errorReason(error);
  const detail = (reason && REASON_COPY[`${code}/${reason}`]) || copy.detail;
  return { code, detail, reason, title: copy.title };
};

// fleetErrorMessage is describeFleetError as one line, with the code to quote.
export const fleetErrorMessage = (error: unknown, fallback?: string): string => {
  const { code, detail, reason, title } = describeFleetError(error, fallback);
  if (code === undefined) {
    return detail;
  }
  return `${title}: ${detail} (error ${code}${reason ? ` ${reason}` : ""})`;
};
