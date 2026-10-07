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
import { describe, expect, it, vi } from "vitest";

import { onApiError, reportApiError, reportApiErrors } from "@/lib/fleet/error-reporter";

describe("reportApiError", () => {
  it("calls every listener even when an earlier one throws", () => {
    const good = vi.fn();
    const bad = vi.fn(() => {
      throw new Error("listener bug");
    });
    const unsubBad = onApiError(bad);
    const unsubGood = onApiError(good);

    expect(() => reportApiError({ code: 1100, reason: undefined })).not.toThrow();

    expect(bad).toHaveBeenCalledOnce();
    expect(good).toHaveBeenCalledWith({ code: 1100, reason: undefined });

    unsubBad();
    unsubGood();
  });
});

describe("reportApiErrors", () => {
  it("rethrows the identical error object", async () => {
    const original = new ConnectError("refused", Code.FailedPrecondition, {
      "x-cryptos-error-code": "1605",
    });
    const next = vi.fn().mockRejectedValue(original);

    await expect(reportApiErrors(next)(fakeRequest())).rejects.toBe(original);
  });

  it("reports the error's code and reason to listeners", async () => {
    const error = new ConnectError("refused", Code.FailedPrecondition, {
      "x-cryptos-error-code": "1605",
      "x-cryptos-error-reason": "EXPIRING",
    });
    const next = vi.fn().mockRejectedValue(error);
    const listener = vi.fn();
    const unsub = onApiError(listener);

    await expect(reportApiErrors(next)(fakeRequest())).rejects.toThrow();

    expect(listener).toHaveBeenCalledWith({ code: 1605, reason: "EXPIRING" });
    unsub();
  });

  it("does not report anything when the call succeeds", async () => {
    const next = vi.fn().mockResolvedValue("ok");
    const listener = vi.fn();
    const unsub = onApiError(listener);

    await expect(reportApiErrors(next)(fakeRequest())).resolves.toBe("ok");

    expect(listener).not.toHaveBeenCalled();
    unsub();
  });
});

// The interceptor only ever reads the request through `next`, so a minimal
// stand-in is enough; its shape is otherwise irrelevant to this module.
const fakeRequest = () => ({}) as never;
