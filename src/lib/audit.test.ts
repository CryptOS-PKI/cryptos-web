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

import { __resetAdapters, setEnabled } from "@/lib/adapters";
import { __resetAudit, auditList, recordAudit } from "@/lib/audit";
import { __resetCerts, issueCert, renewCert, revokeCert } from "@/lib/certs";
import { __resetEnrollments, approveEnrollment, requestEnrollment } from "@/lib/enrollment";
import { __resetNodes } from "@/lib/nodes";
import { __resetProfiles, createProfile } from "@/lib/profiles";

describe("audit store", () => {
  beforeEach(() => __resetAudit());

  it("seeds a history covering multiple kinds", () => {
    expect(auditList().length).toBeGreaterThanOrEqual(8);
    const kinds = new Set(auditList().map((e) => e.kind));
    expect(kinds.has("issued")).toBe(true);
    expect(kinds.has("config-applied")).toBe(true);
  });

  it("recordAudit prepends a new event with a fresh id", () => {
    const before = auditList().length;
    recordAudit({ kind: "issued", summary: "test issue" });
    expect(auditList().length).toBe(before + 1);
    expect(auditList()[0].summary).toBe("test issue");
    expect(auditList()[0].id).toBeTruthy();
    expect(auditList()[0].at).toBeTruthy();
  });
});

describe("audit capture from mutators", () => {
  beforeEach(() => {
    __resetNodes();
    __resetCerts();
    __resetEnrollments();
    __resetAdapters();
    __resetProfiles();
    __resetAudit();
  });

  it("records issue / revoke / renew", async () => {
    const c = await issueCert("acme-issuing-01", {
      kind: "leaf",
      subjectCn: "a.acme.example",
      validityDays: 90,
    });
    expect(auditList()[0].kind).toBe("issued");
    renewCert(c.serial);
    expect(auditList()[0].kind).toBe("renewed");
    const c2 = await issueCert("acme-issuing-01", {
      kind: "leaf",
      subjectCn: "b.acme.example",
      validityDays: 90,
    });
    revokeCert(c2.serial, "keyCompromise");
    expect(auditList()[0].kind).toBe("revoked");
  });

  it("records enrollment approve/reject, protocol toggle, profile create", async () => {
    const req = requestEnrollment({
      address: "10.20.1.99:8443",
      attestation: { nodeId: "nz", tpm: "TPM · sealed" },
      csr: { keyType: "ECDSA P-384", subjectCn: "ACME Issuing CA Z" },
      parentCn: "ACME Intermediate CA G1",
      proposedName: "acme-issuing-z",
      role: "issuing",
    });
    approveEnrollment(req.id);
    expect(auditList()[0].kind).toBe("enroll-approved");
    setEnabled("scep", true);
    expect(auditList()[0].kind).toBe("protocol-toggled");
    await createProfile({
      extKeyUsage: [],
      extraExtensions: [],
      isCA: false,
      keyAlg: "ECDSA-P384",
      keyUsage: [],
      name: "Aud Test",
      sans: { dns: [], email: [], ip: [], uri: [] },
      subject: { commonName: "", country: "", organization: "" },
      validityDays: 365,
    });
    expect(auditList()[0].kind).toBe("profile-created");
  });
});
