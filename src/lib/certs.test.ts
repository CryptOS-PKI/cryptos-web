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

import { beforeEach, describe, expect, it } from "vitest";

import { getNode } from "@/lib/nodes";
import {
  MOCK_NOW_MS,
  allCerts,
  canIssue,
  certsFor,
  daysUntilExpiry,
  expiryClass,
  issueCert,
  renewCert,
  revokeCert,
  __resetCerts,
} from "@/lib/certs";

describe("canIssue", () => {
  it("gates by role and state", () => {
    expect(canIssue(getNode("acme-root-01")!)).toEqual(["subordinate-ca"]);
    expect(canIssue(getNode("acme-intermediate-01")!).sort()).toEqual(["leaf", "subordinate-ca"]);
    expect(canIssue(getNode("acme-issuing-01")!)).toEqual(["leaf"]);
    // acme-intermediate-02 is REVOKED
    expect(canIssue(getNode("acme-intermediate-02")!)).toEqual([]);
  });
});

describe("cert store", () => {
  beforeEach(() => __resetCerts());

  it("seeds certs for an established issuing CA", () => {
    expect(certsFor("acme-issuing-01").length).toBeGreaterThan(0);
  });

  it("issueCert adds a VALID cert to the issuer", async () => {
    const before = certsFor("acme-issuing-01").length;
    const cert = await issueCert("acme-issuing-01", {
      kind: "leaf",
      subjectCn: "web.acme.example",
      sans: ["web.acme.example"],
      eku: ["serverAuth"],
      validityDays: 90,
    });
    expect(cert.status).toBe("VALID");
    expect(cert.kind).toBe("leaf");
    expect(certsFor("acme-issuing-01").length).toBe(before + 1);
    expect(certsFor("acme-issuing-01").some((c) => c.serial === cert.serial)).toBe(true);
  });

  it("revokeCert flips status and records the reason", async () => {
    const cert = await issueCert("acme-issuing-01", {
      kind: "leaf",
      subjectCn: "api.acme.example",
      sans: [],
      eku: ["serverAuth"],
      validityDays: 30,
    });
    revokeCert(cert.serial, "keyCompromise");
    const updated = certsFor("acme-issuing-01").find((c) => c.serial === cert.serial);
    expect(updated?.status).toBe("REVOKED");
    expect(updated?.reason).toBe("keyCompromise");
  });
});

describe("expiry helpers", () => {
  beforeEach(() => __resetCerts());

  it("daysUntilExpiry is measured against the fixed mock clock", async () => {
    const c = await issueCert("acme-issuing-01", {
      kind: "leaf",
      subjectCn: "x.acme.example",
      validityDays: 90,
    });
    // issued at day 0 of MOCK_NOW, so ~90 days remain
    expect(daysUntilExpiry(c)).toBe(90);
  });

  it("expiryClass boundaries: ok/expiring/expired", () => {
    const mk = (days: number, status: "EXPIRED" | "VALID" = "VALID") =>
      ({ notAfter: new Date(MOCK_NOW_MS + days * 86_400_000).toISOString(), status }) as never;
    expect(expiryClass(mk(31))).toBe("ok");
    expect(expiryClass(mk(30))).toBe("expiring");
    expect(expiryClass(mk(0))).toBe("expiring");
    expect(expiryClass(mk(-1))).toBe("expired");
    expect(expiryClass(mk(100, "EXPIRED"))).toBe("expired");
  });

  it("seed includes an expiring and an expired cert", () => {
    const all = allCerts();
    expect(all.some((c) => c.status !== "REVOKED" && expiryClass(c) === "expiring")).toBe(true);
    expect(all.some((c) => expiryClass(c) === "expired")).toBe(true);
  });
});

describe("renewCert", () => {
  beforeEach(() => __resetCerts());

  it("issues a fresh cert with the same subject/profile and supersedes the old one", async () => {
    const orig = await issueCert("acme-issuing-01", {
      kind: "leaf",
      subjectCn: "renew.acme.example",
      validityDays: 90,
      profile: "TLS Server (LDAPS)",
      eku: ["server_auth"],
    });
    const fresh = renewCert(orig.serial);
    expect(fresh).toBeDefined();
    expect(fresh!.serial).not.toBe(orig.serial);
    expect(fresh!.subjectCn).toBe("renew.acme.example");
    expect(fresh!.profile).toBe("TLS Server (LDAPS)");
    expect(fresh!.status).toBe("VALID");
    const oldNow = allCerts().find((c) => c.serial === orig.serial);
    expect(oldNow?.status).toBe("REVOKED");
    expect(oldNow?.reason).toBe("superseded");
  });

  it("returns undefined for a revoked or unknown serial", async () => {
    expect(renewCert("nope")).toBeUndefined();
    const c = await issueCert("acme-issuing-01", {
      kind: "leaf",
      subjectCn: "r.acme.example",
      validityDays: 30,
    });
    revokeCert(c.serial, "keyCompromise");
    expect(renewCert(c.serial)).toBeUndefined();
  });
});
