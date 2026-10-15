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

import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchHealth } from "@/lib/health";

describe("fetchHealth", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the anonymous healthz endpoint", async () => {
    const body = { status: "ok", storage: { mode: "postgres", state: "ok", version: "18.1" } };
    const f = vi.fn().mockResolvedValue({ json: async () => body, ok: true });
    vi.stubGlobal("fetch", f);

    await expect(fetchHealth()).resolves.toEqual(body);
    expect(f).toHaveBeenCalledWith("/healthz", { cache: "no-store" });
  });

  // A 503 (Postgres unreachable) still carries a storage body: readiness
  // fails, but the mode is still worth reading.
  it("reads the body of a 503 response rather than treating it as a failure", async () => {
    const body = { status: "unavailable", storage: { mode: "postgres", state: "unavailable" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => body, ok: false }));

    await expect(fetchHealth()).resolves.toEqual(body);
  });

  it("returns null when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchHealth()).resolves.toBeNull();
  });

  it("returns null when the body has no storage field", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({}), ok: true }));

    await expect(fetchHealth()).resolves.toBeNull();
  });

  it("returns null when the body isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
        ok: true,
      }),
    );

    await expect(fetchHealth()).resolves.toBeNull();
  });
});
