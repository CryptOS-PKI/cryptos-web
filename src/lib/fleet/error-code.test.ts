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

import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";

import { errorCode, ErrorCode } from "@/lib/fleet/error-code";

const coded = (code: string) =>
  new ConnectError(
    "The Fleet Manager refused this request (error 1400). Quote that code when reporting it.",
    Code.FailedPrecondition,
    { "x-cryptos-error-code": code },
  );

describe("errorCode", () => {
  it("reads the manager's numeric code from the error metadata", () => {
    expect(errorCode(coded("1400"))).toBe(ErrorCode.OperatorCAUnconfigured);
  });

  it("returns undefined when the error carries no code", () => {
    expect(errorCode(new ConnectError("down", Code.Unavailable))).toBeUndefined();
    expect(errorCode(new Error("Failed to fetch"))).toBeUndefined();
  });

  it("returns undefined for a malformed code", () => {
    expect(errorCode(coded("abc"))).toBeUndefined();
  });
});
