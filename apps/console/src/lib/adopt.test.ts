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

import type { MachineConfig } from "@cryptos-pki/api-client/cryptos/node/v1/config_pb";

import {
  adoptNode,
  confirmAdoptionFingerprint,
  fingerprintsMatch,
  formatFingerprint,
  previewAdoption,
} from "@/lib/adopt";
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
      if (step.phase === "awaiting-fingerprint-confirmation") {
        await confirmAdoptionFingerprint(step.adoptionId, step.presentedCertSha256);
      }
    }
    expect(phases).toEqual([
      "applying-config",
      "installing",
      "awaiting-reboot",
      "awaiting-fingerprint-confirmation",
      "ceremony",
      "established",
    ]);
    expect(final).toBe(true);
  });

  it("pauses on the installed node's fingerprint until it is confirmed", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const iter = adoptNode("host:9000", "AB:CD", config);
    let step = (await iter.next()).value;
    while (step && step.phase !== "awaiting-fingerprint-confirmation") {
      step = (await iter.next()).value;
    }
    expect(step?.adoptionId).not.toBe("");
    expect(step?.presentedCertSha256).toMatch(/^[0-9a-f]{64}$/);

    let resumed = false;
    const next = iter.next().then((r) => {
      resumed = true;
      return r;
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(resumed).toBe(false);

    await confirmAdoptionFingerprint(step!.adoptionId, step!.presentedCertSha256.toUpperCase());
    expect((await next).value?.phase).toBe("ceremony");
    await iter.return(undefined);
  });

  it("fails the mock adoption on a mismatched fingerprint", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const iter = adoptNode("host:9000", "AB:CD", config);
    let step = (await iter.next()).value;
    while (step && step.phase !== "awaiting-fingerprint-confirmation") {
      step = (await iter.next()).value;
    }
    const next = iter.next();
    await expect(confirmAdoptionFingerprint(step!.adoptionId, "00".repeat(32))).rejects.toThrow(
      /does not match/i,
    );
    await expect(next).rejects.toThrow(/does not match/i);
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

  it("relays the adoption ID and the presented fingerprint", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      adoptNode: vi.fn().mockReturnValue(
        (async function* () {
          yield {
            adoptionId: "adopt-1",
            detail: "",
            done: false,
            phase: "awaiting-fingerprint-confirmation",
            presentedCertSha256: "ab".repeat(32),
          };
        })(),
      ),
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    const seen = [];
    for await (const step of adoptNode("host:9000", "AB:CD", config)) seen.push(step);

    expect(seen).toEqual([
      {
        adoptionId: "adopt-1",
        detail: "",
        done: false,
        phase: "awaiting-fingerprint-confirmation",
        presentedCertSha256: "ab".repeat(32),
      },
    ]);
  });

  it("passes the stop signal to the adoption stream", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const adoptNodeRpc = vi.fn().mockReturnValue((async function* () {})());
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      adoptNode: adoptNodeRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    const controller = new AbortController();

    for await (const _ of adoptNode("host:9000", "AB:CD", config, controller.signal)) {
      // drain
    }

    expect(adoptNodeRpc).toHaveBeenCalledWith(expect.anything(), { signal: controller.signal });
  });

  it("sends the confirmed fingerprint for the adoption", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const confirm = vi.fn().mockResolvedValue({});
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      confirmAdoptionFingerprint: confirm,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    await confirmAdoptionFingerprint("adopt-1", "ab".repeat(32));

    expect(confirm).toHaveBeenCalledWith({ adoptionId: "adopt-1", certSha256: "ab".repeat(32) });
  });

  it("surfaces a live confirm refusal", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      confirmAdoptionFingerprint: vi.fn().mockRejectedValue(new Error("fingerprint mismatch")),
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    await expect(confirmAdoptionFingerprint("adopt-1", "ab".repeat(32))).rejects.toThrow(
      /mismatch/,
    );
  });

  it("surfaces a live preview error (no silent fallback)", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      previewAdoption: vi.fn().mockRejectedValue(new Error("endpoint unreachable")),
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    await expect(previewAdoption("host:9000")).rejects.toThrow(/unreachable/);
  });
});

describe("fingerprint helpers", () => {
  it("compares fingerprints ignoring case, colons and spaces", () => {
    expect(fingerprintsMatch("AB:CD:EF", "abcdef")).toBe(true);
    expect(fingerprintsMatch(" ab cd ef ", "AB:CD:EF")).toBe(true);
    expect(fingerprintsMatch("abcdef", "abcde0")).toBe(false);
    expect(fingerprintsMatch("", "")).toBe(false);
  });

  it("groups a fingerprint in colon-separated uppercase pairs for reading", () => {
    expect(formatFingerprint("abcdef01")).toBe("AB:CD:EF:01");
    expect(formatFingerprint("AB:CD")).toBe("AB:CD");
  });
});
