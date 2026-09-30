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

import type { MachineConfig } from "@/gen/fleet/cryptos/v1/config_pb";

import { adoptNode, previewAdoption } from "@/lib/adopt";
import * as clientMod from "@/lib/fleet/client";
import * as modeMod from "@/lib/fleet/mode";

const config = {} as MachineConfig;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("adopt (mock mode)", () => {
  it("previews a stable maintenance identity offline", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const preview = await previewAdoption("192.168.1.50:9000");
    expect(preview.certSha256).toMatch(/^[0-9A-F:]+$/);
    expect(preview.subject).toContain("192.168.1.50:9000");
  });

  it("rejects an empty endpoint before any call", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    await expect(previewAdoption("   ")).rejects.toThrow(/endpoint/i);
  });

  it("streams the documented phase sequence ending in established/done", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const phases: string[] = [];
    let final = false;
    for await (const step of adoptNode("host:9000", "AB:CD", config)) {
      phases.push(step.phase);
      final = step.done;
    }
    expect(phases).toEqual([
      "applying-config",
      "installing",
      "awaiting-reboot",
      "ceremony",
      "established",
    ]);
    expect(final).toBe(true);
  });

  it("refuses to adopt without a confirmed fingerprint", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const iter = adoptNode("host:9000", "", config);
    await expect(iter.next()).rejects.toThrow(/fingerprint/i);
  });
});

describe("adopt (live mode)", () => {
  it("passes the operator-confirmed pin to the stream and relays each message", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const adoptNodeRpc = vi.fn().mockReturnValue(
      (async function* () {
        yield { detail: "", done: false, phase: "applying-config" };
        yield { detail: "", done: true, phase: "established" };
      })(),
    );
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      adoptNode: adoptNodeRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    const seen: string[] = [];
    for await (const step of adoptNode("host:9000", "AB:CD", config)) seen.push(step.phase);

    expect(adoptNodeRpc).toHaveBeenCalledWith({
      config,
      endpoint: "host:9000",
      pinnedCertSha256: "AB:CD",
    });
    expect(seen).toEqual(["applying-config", "established"]);
  });

  it("surfaces a live preview error (no silent fallback)", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      previewAdoption: vi.fn().mockRejectedValue(new Error("endpoint unreachable")),
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    await expect(previewAdoption("host:9000")).rejects.toThrow(/unreachable/);
  });
});
