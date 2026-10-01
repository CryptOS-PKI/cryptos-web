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

import { ConnectError } from "@connectrpc/connect";

// The manager puts a stable numeric code on every error it returns, under this
// metadata key, so the UI can branch on the number rather than the message
// text. The full table is the manager's docs/error-codes.md.
const METADATA_KEY = "x-cryptos-error-code";

// A 16xx code can carry a sub-reason under this key: the api's ErrorReason
// value name without its ERROR_REASON_ prefix, for example "IS_NODE_CA".
const REASON_METADATA_KEY = "x-cryptos-error-reason";

// When a node refused the request (1108, 1500), the node's own reason,
// sanitised by the manager, rides under this key.
const NODE_REASON_METADATA_KEY = "x-cryptos-node-reason";

export const ErrorCode = {
  OperatorCAUnconfigured: 1400,
  BootstrapTokenInvalid: 1600,
  BootstrapClosed: 1601,
  BootstrapRateLimited: 1602,
  BootstrapUnavailable: 1603,
  BootstrapSessionInvalid: 1604,
  OperatorCARejected: 1605,
  CsrRejected: 1606,
  OperatorCAManagedByConfig: 1607,
  NoRevocationSource: 1608,
  OperatorCAInUse: 1609,
  CertRejected: 1610,
  RequestInvalid: 1611,
} as const;

// errorCode returns the manager's numeric code carried by an error, or
// undefined when there is none (a network failure, or a non-Connect error).
export const errorCode = (error: unknown): number | undefined => {
  const raw = ConnectError.from(error).metadata.get(METADATA_KEY);
  if (raw === null) {
    return undefined;
  }
  const code = Number.parseInt(raw, 10);
  return Number.isNaN(code) ? undefined : code;
};

// errorReason returns the sub-reason carried with a 16xx code, or undefined.
export const errorReason = (error: unknown): string | undefined => {
  const raw = ConnectError.from(error).metadata.get(REASON_METADATA_KEY);
  return raw === null || raw === "" ? undefined : raw;
};

// errorNodeReason returns the reason a node gave for refusing, or undefined.
export const errorNodeReason = (error: unknown): string | undefined => {
  const raw = ConnectError.from(error).metadata.get(NODE_REASON_METADATA_KEY);
  return raw === null || raw === "" ? undefined : raw;
};
