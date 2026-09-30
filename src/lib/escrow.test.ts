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

import { beforeEach, describe, expect, it, vi } from "vitest";

import { exportCAKey, importCAKey } from "@/lib/escrow";

const exportCAKeyRpc = vi.fn();
const importCAKeyRpc = vi.fn();
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({
    exportCAKey: (...args: unknown[]) => exportCAKeyRpc(...args),
    importCAKey: (...args: unknown[]) => importCAKeyRpc(...args),
  }),
}));

let mode: "live" | "mock" = "live";
vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => mode }));

const STRONG = "correct-horse-battery-staple"; // >= 18 chars

describe("escrow lib", () => {
  beforeEach(() => {
    mode = "live";
    exportCAKeyRpc.mockReset();
    importCAKeyRpc.mockReset();
  });

  it("exportCAKey sends the passphrase bytes and returns the envelope (live)", async () => {
    const envelope = new Uint8Array([1, 2, 3]);
    exportCAKeyRpc.mockResolvedValue({ envelope });

    const out = await exportCAKey("acme-root-01", STRONG);

    expect(out).toBe(envelope);
    const arg = exportCAKeyRpc.mock.calls[0][0];
    expect(arg.nodeName).toBe("acme-root-01");
    expect(new TextDecoder().decode(arg.passphrase)).toBe(STRONG);
  });

  it("exportCAKey rejects a short passphrase before any call", async () => {
    await expect(exportCAKey("acme-root-01", "too-short")).rejects.toThrow(/at least 18/);
    expect(exportCAKeyRpc).not.toHaveBeenCalled();
  });

  it("exportCAKey surfaces a live error (no silent fallback)", async () => {
    exportCAKeyRpc.mockRejectedValue(new Error("node refused export"));
    await expect(exportCAKey("acme-root-01", STRONG)).rejects.toThrow(/node refused export/);
  });

  it("exportCAKey returns a dummy envelope in mock mode without dialing", async () => {
    mode = "mock";
    const out = await exportCAKey("acme-root-01", STRONG);
    expect(out.length).toBeGreaterThan(0);
    expect(exportCAKeyRpc).not.toHaveBeenCalled();
  });

  it("importCAKey relays envelope and passphrase and returns the CN summary (live)", async () => {
    importCAKeyRpc.mockResolvedValue({ issuerCn: "ACME Root CA", subjectCn: "ACME Sub CA" });
    const envelope = new Uint8Array([9, 8, 7]);

    const out = await importCAKey("acme-fresh-01", envelope, STRONG);

    expect(out).toEqual({ issuerCn: "ACME Root CA", subjectCn: "ACME Sub CA" });
    const arg = importCAKeyRpc.mock.calls[0][0];
    expect(arg.nodeName).toBe("acme-fresh-01");
    expect(arg.envelope).toBe(envelope);
    expect(new TextDecoder().decode(arg.passphrase)).toBe(STRONG);
  });

  it("importCAKey rejects an empty envelope and a short passphrase before any call", async () => {
    await expect(importCAKey("acme-fresh-01", new Uint8Array(), STRONG)).rejects.toThrow(
      /envelope file is required/,
    );
    await expect(importCAKey("acme-fresh-01", new Uint8Array([1]), "too-short")).rejects.toThrow(
      /at least 18/,
    );
    expect(importCAKeyRpc).not.toHaveBeenCalled();
  });

  it("importCAKey surfaces the node's already-has-identity error", async () => {
    importCAKeyRpc.mockRejectedValue(
      new Error('node "acme-fresh-01" already has a CA identity; import only onto a fresh node'),
    );
    await expect(importCAKey("acme-fresh-01", new Uint8Array([1]), STRONG)).rejects.toThrow(
      /already has a CA identity/,
    );
  });
});
