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

const NODE_ULID = "01HZXQJ3VJ7N9Q2M4T6P8R1S5W";

const base = {
  dpr: 2,
  now: new Date("2026-10-06T18:00:00Z"),
  params: { nodeId: NODE_ULID },
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
      params: { nodeId: NODE_ULID },
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

  it("redacts identity-looking params but keeps the ULID", () => {
    const out = JSON.parse(
      buildUiIssueBundle({
        ...base,
        params: { name: "alice", nodeId: NODE_ULID, serial: "4F:9A:11:02" },
      }),
    );
    expect(out.params).toEqual({ nodeId: NODE_ULID });
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

describe("param redaction: only a ULID or a UUID is an opaque id", () => {
  it.each([
    ["01HZXQJ3VJ7N9Q2M4T6P8R1S5W", true],
    ["3f29c9de-1b1a-4b5a-9c1e-8a2b6e7d4f10", true],
    ["alice", false],
    ["4F:9A:11:02", false],
    // A prefix_username shape reads as plausible, but it is a real username,
    // not an opaque id -- a decimal serial has the same problem.
    ["j_smith", false],
    ["admin_alice", false],
    ["pki_node1", false],
    // Stands in for the shape of a real surname-initial username, swapped for
    // a fake one so no real identifier lands in this public repo.
    ["s_jdoe", false],
    ["ca_root01", false],
    ["123456789012", false],
  ])("value %s: kept = %s", (value, kept) => {
    const out = JSON.parse(buildUiIssueBundle({ ...base, params: { v: value } }));
    expect(out.params ?? {}).toEqual(kept ? { v: value } : {});
  });
});

describe("redactMessage", () => {
  it("redacts Basic auth credentials", () => {
    const m = redactMessage("Authorization: Basic dXNlcjpwYXNzd29yZA==");
    expect(m).toBe("Authorization: Basic [redacted]");
  });

  it("redacts a cookie-style key=value pair", () => {
    const m = redactMessage("Cookie: session=0123456789abcdef0123456789");
    expect(m).toBe("Cookie: [redacted]");
  });

  it("redacts URL userinfo, keeping neither the user nor the password", () => {
    const m = redactMessage("GET https://admin:hunter2@fm.example.org/x failed");
    expect(m).not.toMatch(/admin|hunter2|fm\.example\.org/);
    expect(m).toContain("https://[host]/x");
  });

  it("redacts a URL fragment", () => {
    const m = redactMessage("redirect to /callback#access_token=abc.def failed");
    expect(m).not.toMatch(/access_token|abc\.def/);
  });

  it("redacts a long base64/hex secret of 24 or more characters", () => {
    const secret = Array.from({ length: 48 }, (_, i) => (i % 16).toString(16)).join("");
    const m = redactMessage(`leaked secret: ${secret}`);
    expect(m).not.toContain(secret);
    expect(m).toContain("[redacted]");
  });

  it("does not treat a long run of one repeated letter as a secret", () => {
    // Pinned above too (the 200-char truncation case): a token with no digit
    // is left alone rather than collapsed to "[redacted]".
    expect(redactMessage("x".repeat(30))).toBe("x".repeat(30));
  });

  it("redacts an unterminated PEM block to the end of the string", () => {
    const m = redactMessage(
      "key import failed: -----BEGIN PRIVATE KEY-----MIIEvQIBADANBgkqhkiG9w0BAQEF",
    );
    expect(m).toBe("key import failed: [pem]");
  });

  it("redacts an IPv4 address", () => {
    expect(redactMessage("connection from 192.0.2.10 refused")).toBe(
      "connection from [ip] refused",
    );
  });

  it("redacts an IPv6 address", () => {
    expect(redactMessage("connection from 2001:db8::1 refused")).toBe(
      "connection from [ip] refused",
    );
  });

  it("collapses a scheme://host to scheme://[host]", () => {
    expect(redactMessage("GET https://fm.example.org:8443/nodes/abc failed")).toBe(
      "GET https://[host]/nodes/abc failed",
    );
  });

  it("redacts a bare FQDN hostname with no scheme", () => {
    expect(redactMessage("could not resolve pki-01.corp.example.org")).toBe(
      "could not resolve [host]",
    );
  });
});
