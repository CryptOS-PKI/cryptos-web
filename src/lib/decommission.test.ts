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

import { decommissionNode } from "@/lib/decommission";
import * as clientMod from "@/lib/fleet/client";
import * as modeMod from "@/lib/fleet/mode";
import * as nodesMod from "@/lib/nodes";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("decommissionNode", () => {
  it("requires the confirmation CN before any call", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    await expect(decommissionNode("acme-edge-07", "  ")).rejects.toThrow(/Root CA CN/i);
  });

  it("is a no-op that resolves in mock mode", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    await expect(decommissionNode("acme-edge-07", "ACME Root CA G1")).resolves.toBeUndefined();
  });

  it("routes through the manager with the echoed CN and refetches the fleet in live mode", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const decommissionNodeRpc = vi.fn().mockResolvedValue({ rebooting: true });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      decommissionNode: decommissionNodeRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    const refresh = vi.spyOn(nodesMod, "refreshLiveNodes").mockResolvedValue();

    await decommissionNode("acme-edge-07", "ACME Root CA G1");
    expect(decommissionNodeRpc).toHaveBeenCalledWith({
      confirmCommonName: "ACME Root CA G1",
      nodeName: "acme-edge-07",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("surfaces a CN-mismatch permission error to the caller", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      decommissionNode: vi.fn().mockRejectedValue(new Error("permission denied: CN mismatch")),
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    await expect(decommissionNode("acme-edge-07", "wrong")).rejects.toThrow(/mismatch/);
  });
});
