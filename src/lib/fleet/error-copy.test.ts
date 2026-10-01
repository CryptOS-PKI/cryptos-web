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

import { ErrorCode, ErrorReason } from "@/gen/fleet/cryptos/fleet/v1/errors_pb";
import { describeFleetError, fleetErrorMessage } from "@/lib/fleet/error-copy";

const refusal = (code: number, reason?: string): ConnectError =>
  new ConnectError("refused", Code.FailedPrecondition, {
    "x-cryptos-error-code": String(code),
    ...(reason ? { "x-cryptos-error-reason": reason } : {}),
  });

// The sub-reasons each code can carry, as the api's errors.proto lists them.
const REASONS_BY_CODE: Record<number, string[]> = {
  1600: [],
  1601: [],
  1602: [],
  1603: ["DATABASE_REQUIRED", "FIRST_RUN_DISABLED"],
  1604: [],
  1605: [
    "NOT_A_CA",
    "EXPIRING",
    "KEY_TYPE",
    "IS_NODE_CA",
    "CRL_SIGN_MISSING",
    "NO_CRL_NOT_ACKNOWLEDGED",
    "CRL_UNREACHABLE",
    "CRL_INVALID",
    "CRL_ROLLBACK",
    "OCSP_UNREACHABLE",
    "OCSP_INVALID",
    "NOT_CONFIRMED",
    "ROTATION_IN_PROGRESS",
  ],
  1606: ["SIZE", "SIGNATURE", "SUBJECT_MISMATCH", "KEY_TYPE"],
  1607: [],
  1608: ["STALE_CRL", "STALE_OCSP", "STALE_DENYLIST", "NO_CRL", "DATABASE_REQUIRED"],
  1609: [],
  1610: [
    "NOT_CHAINED",
    "NOT_ACTIVE_ANCHOR",
    "WRONG_LEVEL",
    "LEVEL_EXT_CRITICAL",
    "EKU",
    "KEY_USAGE",
    "BASIC_CONSTRAINTS",
    "SUBJECT_MISMATCH",
    "KEY_TYPE",
    "KEY_MISMATCH",
    "EXPIRING",
    "REVOKED",
    "REVOKED_OCSP",
    "OCSP_UNKNOWN",
    "DUPLICATE",
  ],
  1611: ["NOT_FOUND", "EXPIRED", "NOT_PENDING"],
};

const codes = Object.values(ErrorCode).filter((v): v is number => typeof v === "number" && v !== 0);

describe("describeFleetError", () => {
  it("covers every code in the 1600-1611 contract", () => {
    expect([...codes].sort((a, b) => a - b)).toEqual(Object.keys(REASONS_BY_CODE).map(Number));
  });

  it.each(codes)("gives code %i its own title and detail", (code) => {
    const copy = describeFleetError(refusal(code));
    expect(copy.code).toBe(code);
    expect(copy.title).not.toBe("");
    expect(copy.detail).not.toBe("");
    expect(copy.title).not.toBe("Request failed");
  });

  const pairs = Object.entries(REASONS_BY_CODE).flatMap(([code, reasons]) =>
    reasons.map((reason) => [Number(code), reason] as const),
  );

  it.each(pairs)("gives %i/%s a detail of its own", (code, reason) => {
    const generic = describeFleetError(refusal(code)).detail;
    const copy = describeFleetError(refusal(code, reason));
    expect(copy.reason).toBe(reason);
    expect(copy.detail).not.toBe("");
    expect(copy.detail).not.toBe(generic);
  });

  it("names every sub-reason in the contract under at least one code", () => {
    const listed = new Set(Object.values(REASONS_BY_CODE).flat());
    const names = Object.keys(ErrorReason).filter(
      (k) => Number.isNaN(Number(k)) && k !== "UNSPECIFIED",
    );
    for (const name of names) expect(listed.has(name), name).toBe(true);
  });

  it("reads a shared sub-reason with its code", () => {
    const ca = describeFleetError(refusal(1605, "KEY_TYPE")).detail;
    const csr = describeFleetError(refusal(1606, "KEY_TYPE")).detail;
    expect(ca).not.toBe(csr);
  });

  it("falls back to the code's detail for a sub-reason it does not know", () => {
    const generic = describeFleetError(refusal(1610)).detail;
    expect(describeFleetError(refusal(1610, "SOMETHING_NEW")).detail).toBe(generic);
  });

  it("keeps the error's own message when there is no 16xx code", () => {
    const copy = describeFleetError(new Error("network down"));
    expect(copy.code).toBeUndefined();
    expect(copy.detail).toBe("network down");
  });

  it("builds one line with the title and the detail", () => {
    const line = fleetErrorMessage(refusal(1610, "REVOKED_OCSP"));
    expect(line).toMatch(/OCSP/);
    expect(line).toContain(describeFleetError(refusal(1610)).title);
  });
});

describe("describeFleetError for LINK refusals", () => {
  it.each([1100, 1102, 1106, 1107])("gives code %i its own title and detail", (code) => {
    const copy = describeFleetError(refusal(code));
    expect(copy.code).toBe(code);
    expect(copy.title).not.toBe("Request failed");
    expect(copy.detail).not.toBe("");
  });

  it("tells the operator what ca_pem must hold when the node is refused", () => {
    expect(describeFleetError(refusal(1106)).detail).toMatch(/CA certificate/);
    expect(fleetErrorMessage(refusal(1106))).toContain("(error 1106)");
  });
});
