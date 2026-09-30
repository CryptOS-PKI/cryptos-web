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

import { beforeEach, describe, expect, it, vi } from "vitest";

import { type BuildInfo, buildReport, fetchBuildInfo } from "@/lib/diagnostics";

const build: BuildInfo = {
  buildDate: "2026-09-22T09:00:00Z",
  commit: "abc1234",
  version: "v1.2.3",
  webRef: "deadbeef",
};

describe("buildReport", () => {
  // The whole point: a pasted block that answers which build and which page,
  // so a report does not cost a round trip establishing them (#83).
  it("carries the build, the page and the browser", () => {
    const report = buildReport({
      build,
      fleetMode: "live-auth",
      operator: null,
      reason: null,
      route: "/fleet",
      status: "anonymous",
      userAgent: "Mozilla/5.0 (probe)",
    });

    expect(report).toContain("v1.2.3");
    expect(report).toContain("abc1234");
    expect(report).toContain("deadbeef");
    expect(report).toContain("/fleet");
    expect(report).toContain("Mozilla/5.0 (probe)");
    expect(report).toContain("live-auth");
  });

  it("includes the operator and the denial reason when there is one", () => {
    const report = buildReport({
      build,
      fleetMode: "live-auth",
      operator: { commonName: "operator@example.org", level: "admin", serial: "0A:BC" },
      reason: "not-authorized",
      route: "/",
      status: "denied",
      userAgent: "probe",
    });

    expect(report).toContain("operator@example.org");
    expect(report).toContain("admin");
    expect(report).toContain("0A:BC");
    expect(report).toContain("denied (not-authorized)");
  });

  // A manager too old to serve /version is itself the finding, so the report
  // has to say so rather than omit the line and look complete.
  it("says so when the build could not be read", () => {
    const report = buildReport({
      build: null,
      fleetMode: "live",
      operator: null,
      reason: null,
      route: "/",
      status: "anonymous",
      userAgent: "probe",
    });

    expect(report).toMatch(/manager\s+unavailable/);
    expect(report).toContain("/version");
  });
});

describe("fetchBuildInfo", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the anonymous version endpoint", async () => {
    const f = vi.fn().mockResolvedValue({ json: async () => build, ok: true });
    vi.stubGlobal("fetch", f);

    await expect(fetchBuildInfo()).resolves.toEqual(build);
    expect(f).toHaveBeenCalledWith("/version", { cache: "no-store" });
  });

  // An older manager has no /version at all, and the report must still be
  // produced -- that absence is a fact worth reporting.
  it("returns null rather than throwing when the endpoint is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(fetchBuildInfo()).resolves.toBeNull();
  });

  it("returns null when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchBuildInfo()).resolves.toBeNull();
  });
});
