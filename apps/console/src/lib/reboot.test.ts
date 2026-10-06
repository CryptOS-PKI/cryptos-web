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

import { afterEach, describe, expect, it, vi } from "vitest";

import * as clientMod from "@/lib/fleet/client";
import * as modeMod from "@/lib/fleet/mode";
import * as nodesMod from "@/lib/nodes";
import { rebootNode } from "@/lib/reboot";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rebootNode", () => {
  it("requires the confirmation CN before any call", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    await expect(rebootNode("acme-edge-07", "  ", false)).rejects.toThrow(/CA CN/i);
  });

  it("is a no-op that resolves in mock mode", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    await expect(rebootNode("acme-edge-07", "ACME Root CA G1", false)).resolves.toBeUndefined();
  });

  it("routes through the manager with the echoed CN and power_off, and refetches the fleet in live mode", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const rebootNodeRpc = vi.fn().mockResolvedValue({ rebooting: true });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      rebootNode: rebootNodeRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    const refresh = vi.spyOn(nodesMod, "refreshLiveNodes").mockResolvedValue();

    await rebootNode("acme-edge-07", "ACME Root CA G1", true);
    expect(rebootNodeRpc).toHaveBeenCalledWith({
      confirmCaCn: "ACME Root CA G1",
      nodeName: "acme-edge-07",
      powerOff: true,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("defaults power_off to false", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const rebootNodeRpc = vi.fn().mockResolvedValue({ rebooting: true });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      rebootNode: rebootNodeRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    vi.spyOn(nodesMod, "refreshLiveNodes").mockResolvedValue();

    await rebootNode("acme-edge-07", "ACME Root CA G1");
    expect(rebootNodeRpc).toHaveBeenCalledWith({
      confirmCaCn: "ACME Root CA G1",
      nodeName: "acme-edge-07",
      powerOff: false,
    });
  });

  it("surfaces a CN-mismatch permission error to the caller", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      rebootNode: vi.fn().mockRejectedValue(new Error("permission denied: CN mismatch")),
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    await expect(rebootNode("acme-edge-07", "wrong", false)).rejects.toThrow(/mismatch/);
  });
});
