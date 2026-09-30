/*
Apache License 2.0

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

import { afterEach, describe, expect, it, vi } from "vitest";

import * as clientMod from "@/lib/fleet/client";
import * as modeMod from "@/lib/fleet/mode";
import { __resetMcpKeys, createMcpKey, listMcpKeys, revokeMcpKey } from "@/lib/mcp-keys";

afterEach(() => {
  vi.restoreAllMocks();
  __resetMcpKeys();
});

const wireKey = {
  clientName: "Example Agent",
  createdAt: "2026-09-01T00:00:00Z",
  id: "key-1",
  label: "build agent",
  lastUsedAt: "",
  levelCeiling: "operator",
  operatorCn: "operator@example.org",
  operatorSerial: "0A:BC",
  revokedAt: "",
};

describe("mcp keys (live)", () => {
  it("lists through ListMcpKeys, passing the all-keys scope", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const listMcpKeysRpc = vi.fn().mockResolvedValue({ items: [wireKey] });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      listMcpKeys: listMcpKeysRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    const rows = await listMcpKeys({ all: true });

    expect(listMcpKeysRpc).toHaveBeenCalledWith({ all: true });
    expect(rows).toEqual([{ ...wireKey, revoked: false }]);
  });

  it("creates through CreateMcpKey and hands back the plaintext once", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const createMcpKeyRpc = vi
      .fn()
      .mockResolvedValue({ mcpKey: wireKey, plaintextKey: "fos_mcp_example" });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      createMcpKey: createMcpKeyRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    const created = await createMcpKey({ label: "build agent", levelCeiling: "viewer" });

    expect(createMcpKeyRpc).toHaveBeenCalledWith({ label: "build agent", levelCeiling: "viewer" });
    expect(created.plaintextKey).toBe("fos_mcp_example");
    expect(created.key.id).toBe("key-1");
  });

  it("revokes through RevokeMcpKey by id", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const revokeMcpKeyRpc = vi.fn().mockResolvedValue({});
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      revokeMcpKey: revokeMcpKeyRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    await revokeMcpKey("key-1");

    expect(revokeMcpKeyRpc).toHaveBeenCalledWith({ id: "key-1" });
  });
});

describe("mcp keys (mock)", () => {
  it("creates a key that then lists as active, and revokes it", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const created = await createMcpKey({ label: "laptop", levelCeiling: "viewer" });
    expect(created.plaintextKey).toMatch(/^fos_mcp_/);

    const listed = (await listMcpKeys({ all: false })).find((k) => k.id === created.key.id);
    expect(listed).toMatchObject({ label: "laptop", levelCeiling: "viewer", revoked: false });

    await revokeMcpKey(created.key.id);
    const after = (await listMcpKeys({ all: false })).find((k) => k.id === created.key.id);
    expect(after?.revoked).toBe(true);
  });

  it("shows only the caller's keys unless all is asked for", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const own = await listMcpKeys({ all: false });
    const all = await listMcpKeys({ all: true });
    expect(all.length).toBeGreaterThan(own.length);
  });
});
