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

import { describe, expect, it } from "vitest";

import { createErrorRing } from "./error-ring";
import { buildUiIssueBundle, redactMessage } from "./ui-issue";

const base = {
  dpr: 2,
  now: new Date("2026-10-06T18:00:00Z"),
  params: { nodeId: "n_01HZX" },
  path: "/nodes/:nodeId",
  role: "operator" as const,
  route: "/nodes/:nodeId",
  sha: "abc1234",
  ua: "UA",
  vh: 800,
  vw: 1280,
};

describe("buildUiIssueBundle", () => {
  it("emits schema v1 on one line with empty keys omitted", () => {
    const out = buildUiIssueBundle(base);
    expect(out).not.toContain("\n");
    expect(JSON.parse(out)).toEqual({
      app: "cryptos-web/console",
      dpr: 2,
      params: { nodeId: "n_01HZX" },
      path: "/nodes/:nodeId",
      product: "cryptos",
      role: "operator",
      route: "/nodes/:nodeId",
      sha: "abc1234",
      t: "2026-10-06T14:00:00.000-04:00",
      ua: "UA",
      v: 1,
      vh: 800,
      vw: 1280,
    });
  });

  // DST pin: October is EDT (-04:00, covered above); January is EST (-05:00).
  it("emits the ET offset for a winter month (EST, no DST)", () => {
    const out = JSON.parse(buildUiIssueBundle({ ...base, now: new Date("2026-01-06T18:00:00Z") }));
    expect(out.t).toBe("2026-01-06T13:00:00.000-05:00");
  });

  it("redacts identity-looking params", () => {
    const out = JSON.parse(
      buildUiIssueBundle({
        ...base,
        params: { name: "alice", nodeId: "n_01HZX", serial: "4F:9A:11:02" },
      }),
    );
    expect(out.params).toEqual({ nodeId: "n_01HZX" });
  });

  it("redacts error messages", () => {
    const m = redactMessage(
      "GET https://fm.example.org/x?token=abc failed for bob@example.org Bearer eyJhbGciOi.x.y -----BEGIN CERTIFICATE-----MII-----END CERTIFICATE-----",
    );
    expect(m).not.toMatch(/token=|bob@|eyJ|BEGIN CERT/);
    expect(redactMessage("x".repeat(500)).length).toBe(200);
  });

  it("keeps at most five recent errors", () => {
    const ring = createErrorRing();
    for (let i = 0; i < 8; i++) ring.push({ at: "t", m: `e${i}`, src: "window" });
    expect(ring.all().map((e) => e.m)).toEqual(["e3", "e4", "e5", "e6", "e7"]);
  });
});
