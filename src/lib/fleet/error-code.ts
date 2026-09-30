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

import { ConnectError } from "@connectrpc/connect";

// The manager puts a stable numeric code on every error it returns, under this
// metadata key, so the UI can branch on the number rather than the message
// text. The full table is the manager's docs/error-codes.md.
const METADATA_KEY = "x-cryptos-error-code";

export const ErrorCode = {
  OperatorCAUnconfigured: 1400,
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
