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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as clientMod from "@/lib/fleet/client";
import * as modeMod from "@/lib/fleet/mode";
import {
  __resetOperators,
  cancelCredentialRequest,
  createCredentialRequest,
  credentialFileBase,
  DENY_REASONS,
  denyOperatorCredential,
  levelExtfileSection,
  listCredentialRequests,
  listOperatorCredentials,
  recordOperatorCredential,
} from "@/lib/operators";

const live = (rpcs: Record<string, unknown>) => {
  vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
  vi.spyOn(clientMod, "fleetClient").mockReturnValue(
    rpcs as unknown as ReturnType<typeof clientMod.fleetClient>,
  );
};

beforeEach(() => __resetOperators());
afterEach(() => vi.restoreAllMocks());

describe("operators (mock mode)", () => {
  beforeEach(() => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
  });

  it("lists credentials with their kind, issuer and revocation sources", async () => {
    const items = await listOperatorCredentials();
    expect(items.length).toBeGreaterThan(0);
    const kinds = new Set(items.map((i) => i.kind));
    expect(kinds.has("first_admin")).toBe(true);
    expect(kinds.has("observed")).toBe(true);
    expect(items.some((i) => i.denylisted)).toBe(true);
    expect(items.every((i) => typeof i.crlRevoked === "boolean")).toBe(true);
  });

  it("creates a pending request that returns the CSR, extfile section and command", async () => {
    const created = await createCredentialRequest({
      csrDer: new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x01]),
      email: "Bob@Example.org",
      fullName: "Bob Example",
      level: "operator",
    });
    expect(created.requestId).not.toBe("");
    expect(created.csrPem).toMatch(/^-----BEGIN CERTIFICATE REQUEST-----/);
    expect(created.extfileSection).toContain("DER:13:08:6F:70:65:72:61:74:6F:72");
    expect(created.opensslCommand).toBe(
      "openssl ca -config operator-ca.cnf -extensions op_operator -notext -in fleetos-operator-bob@example.org.csr -out fleetos-operator-bob@example.org.crt",
    );

    const pending = await listCredentialRequests();
    expect(pending.map((r) => r.id)).toContain(created.requestId);
    expect(pending.find((r) => r.id === created.requestId)?.email).toBe("bob@example.org");
  });

  it("refuses an unknown level or an empty CSR before any call", async () => {
    await expect(
      createCredentialRequest({
        csrDer: new Uint8Array([1]),
        email: "a@example.org",
        fullName: "A",
        level: "root",
      }),
    ).rejects.toThrow(/level/i);
    await expect(
      createCredentialRequest({
        csrDer: new Uint8Array(),
        email: "a@example.org",
        fullName: "A",
        level: "viewer",
      }),
    ).rejects.toThrow(/csr/i);
  });

  it("cancels a pending request", async () => {
    const [first] = await listCredentialRequests();
    await cancelCredentialRequest(first.id);
    expect((await listCredentialRequests()).map((r) => r.id)).not.toContain(first.id);
    expect((await listCredentialRequests("")).find((r) => r.id === first.id)?.state).toBe(
      "cancelled",
    );
  });

  it("records a certificate against a request and completes it", async () => {
    const [first] = await listCredentialRequests();
    const { credential } = await recordOperatorCredential({
      certDer: new Uint8Array([0x30, 0x00]),
      requestId: first.id,
    });
    expect(credential.kind).toBe("requested");
    expect(credential.email).toBe(first.email);
    const done = (await listCredentialRequests("")).find((r) => r.id === first.id);
    expect(done?.state).toBe("completed");
    expect(done?.completedSerial).toBe(credential.serialHex);
  });

  it("denies a credential and warns to revoke at the CA as well", async () => {
    const [target] = (await listOperatorCredentials()).filter((r) => !r.denylisted);
    const result = await denyOperatorCredential({
      note: "left the team",
      reasonCode: 3,
      serialHex: target.serialHex,
    });
    expect(result.warnings.join(" ")).toMatch(/revoke .* at your CA/i);
    const after = (await listOperatorCredentials()).find((r) => r.serialHex === target.serialHex);
    expect(after?.denylisted).toBe(true);
    expect(after?.revoked).toBe(true);
  });
});

describe("DENY_REASONS", () => {
  it("offers RFC 5280 reason codes 0 to 10 except 7", () => {
    expect(DENY_REASONS.map((r) => r.code).sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 8, 9, 10,
    ]);
  });
});

describe("credentialFileBase", () => {
  it("replaces anything a shell could read as syntax, as the manager does", () => {
    expect(credentialFileBase("admin", "a.b-c_d@example.org")).toBe(
      "fleetos-admin-a.b-c_d@example.org",
    );
    expect(credentialFileBase("viewer", "x$(id)'y@example.org")).toBe(
      "fleetos-viewer-x__id__y@example.org",
    );
  });
});

describe("levelExtfileSection", () => {
  it("encodes each level as a PrintableString DER value", () => {
    expect(levelExtfileSection("admin")).toContain(
      "1.3.6.1.4.1.59999.1.1  = DER:13:05:61:64:6D:69:6E",
    );
    expect(levelExtfileSection("viewer")).toContain("DER:13:06:76:69:65:77:65:72");
  });
});

describe("operators (live mode)", () => {
  it("maps every credential field from ListOperatorCredentials", async () => {
    live({
      listOperatorCredentials: vi.fn().mockResolvedValue({
        items: [
          {
            commonName: "alice@example.org",
            crlRevoked: true,
            denylisted: false,
            email: "alice@example.org",
            firstSeenAt: "2026-09-01T00:00:00Z",
            fullName: "Alice Example",
            issuerSha256: "ab".repeat(32),
            kind: "observed",
            lastSeenAt: "2026-09-02T00:00:00Z",
            level: "operator",
            notAfter: "2027-09-01T00:00:00Z",
            revoked: true,
            serialHex: "0A:0B",
          },
        ],
      }),
    });
    const [row] = await listOperatorCredentials();
    expect(row).toEqual({
      commonName: "alice@example.org",
      crlRevoked: true,
      denylisted: false,
      email: "alice@example.org",
      firstSeenAt: "2026-09-01T00:00:00Z",
      fullName: "Alice Example",
      issuerSha256: "ab".repeat(32),
      kind: "observed",
      lastSeenAt: "2026-09-02T00:00:00Z",
      level: "operator",
      notAfter: "2027-09-01T00:00:00Z",
      revoked: true,
      serialHex: "0A:0B",
    });
  });

  it("sends only the level, email, name and CSR when creating a request", async () => {
    const rpc = vi.fn().mockResolvedValue({
      csrPem: "pem",
      expiresAt: "2026-10-30T00:00:00Z",
      extfileSection: "[ op_admin ]",
      opensslCommand: "openssl ca",
      requestId: "req-1",
    });
    live({ createOperatorCredentialRequest: rpc });
    const csrDer = new Uint8Array([1, 2, 3]);
    const created = await createCredentialRequest({
      csrDer,
      email: " Alice@Example.org ",
      fullName: " Alice ",
      level: "admin",
    });
    expect(rpc).toHaveBeenCalledWith({
      csrDer,
      email: "alice@example.org",
      fullName: "Alice",
      level: "admin",
    });
    expect(created.requestId).toBe("req-1");
  });

  it("lists pending requests by default", async () => {
    const rpc = vi.fn().mockResolvedValue({ items: [] });
    live({ listOperatorCredentialRequests: rpc });
    await listCredentialRequests();
    expect(rpc).toHaveBeenCalledWith({ state: "pending" });
  });

  it("records with the request id and returns the warnings", async () => {
    const rpc = vi.fn().mockResolvedValue({
      credential: { commonName: "a@example.org", serialHex: "01" },
      warnings: ["validity over 400 days"],
    });
    live({ recordOperatorCredential: rpc });
    const certDer = new Uint8Array([9]);
    const result = await recordOperatorCredential({ certDer, requestId: "req-1" });
    expect(rpc).toHaveBeenCalledWith({ certDer, fullName: "", requestId: "req-1" });
    expect(result.warnings).toEqual(["validity over 400 days"]);
  });

  it("denies with the reason, note and issuer and surfaces errors", async () => {
    const rpc = vi.fn().mockResolvedValue({
      issuerSha256: "cd".repeat(32),
      revokedAt: "2026-09-30T00:00:00Z",
      serialHex: "01",
      warnings: ["also revoke at your CA"],
    });
    live({ revokeOperatorCredential: rpc });
    await denyOperatorCredential({
      issuerSha256: "cd".repeat(32),
      note: "lost laptop",
      reasonCode: 1,
      serialHex: "01",
    });
    expect(rpc).toHaveBeenCalledWith({
      issuerSha256: "cd".repeat(32),
      note: "lost laptop",
      reasonCode: 1,
      serialHex: "01",
    });

    live({ revokeOperatorCredential: vi.fn().mockRejectedValue(new Error("denied")) });
    await expect(
      denyOperatorCredential({ note: "", reasonCode: 0, serialHex: "01" }),
    ).rejects.toThrow(/denied/);
  });
});
