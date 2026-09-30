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

import { afterEach, describe, expect, it, vi } from "vitest";

import * as clientMod from "@/lib/fleet/client";
import * as modeMod from "@/lib/fleet/mode";
import {
  issueOperatorCredential,
  listOperatorCredentials,
  revokeOperatorCredential,
} from "@/lib/operators";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("operators (mock mode)", () => {
  it("lists a coherent set of mock credentials", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const items = await listOperatorCredentials();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty("commonName");
    expect(items[0]).toHaveProperty("level");
    expect(items[0]).toHaveProperty("serialHex");
  });

  it("issues a mock credential returning cert bytes and a serial without a live call", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const result = await issueOperatorCredential(
      "op@acme.example",
      "operator",
      new Uint8Array([1]),
    );
    expect(result.serialHex).toMatch(/^[0-9a-f:]+$/i);
    expect(result.certDer.length).toBeGreaterThan(0);
  });

  it("revokes a mock credential without a live call", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    await expect(revokeOperatorCredential("AA:BB", 4)).resolves.toBeUndefined();
  });

  it("rejects an unknown level before any call", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    await expect(issueOperatorCredential("op", "superuser", new Uint8Array([1]))).rejects.toThrow(
      /level/i,
    );
  });

  it("rejects an empty CSR before any call", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    await expect(issueOperatorCredential("op", "admin", new Uint8Array())).rejects.toThrow(/csr/i);
  });
});

describe("operators (live mode)", () => {
  it("routes issue through the FleetService and returns the signed cert", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const issueOperatorCredentialRpc = vi
      .fn()
      .mockResolvedValue({ certDer: new Uint8Array([9, 9]), serialHex: "0A:0B" });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      issueOperatorCredential: issueOperatorCredentialRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    const csr = new Uint8Array([1, 2, 3]);
    const result = await issueOperatorCredential("op@acme.example", "admin", csr);
    expect(issueOperatorCredentialRpc).toHaveBeenCalledWith({
      commonName: "op@acme.example",
      csrDer: csr,
      level: "admin",
    });
    expect(result.serialHex).toBe("0A:0B");
  });

  it("surfaces a live revoke error to the caller (no silent fallback)", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      revokeOperatorCredential: vi.fn().mockRejectedValue(new Error("operator-CA unreachable")),
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    await expect(revokeOperatorCredential("0A:0B", 1)).rejects.toThrow(/unreachable/);
  });
});
