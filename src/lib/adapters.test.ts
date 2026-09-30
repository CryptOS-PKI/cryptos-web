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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetAdapters,
  adaptersList,
  getAdapter,
  setEnabled,
  updateAdapter,
} from "@/lib/adapters";

// currentMode drives the mocked fleetMode(); each describe sets it.
let currentMode: "live" | "live-auth" | "mock" = "mock";
const listAdapters = vi.fn();
const setAdapterEnabled = vi.fn();

vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => currentMode }));
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({
    listAdapters,
    setAdapterEnabled,
  }),
}));

describe("adapters store", () => {
  beforeEach(() => {
    currentMode = "mock";
    __resetAdapters();
  });

  it("seeds four adapters with ACME enabled and bound to the LDAPS profile", () => {
    expect(adaptersList().length).toBe(4);
    expect(getAdapter("acme")?.enabled).toBe(true);
    expect(getAdapter("acme")?.profile).toBe("TLS Server (LDAPS)");
    expect(getAdapter("scep")?.enabled).toBe(false);
  });

  it("setEnabled toggles an adapter", async () => {
    const res = await setEnabled("scep", true);
    expect(res.ok).toBe(true);
    expect(getAdapter("scep")?.enabled).toBe(true);
  });

  it("updateAdapter patches the bound profile", () => {
    updateAdapter("acme", { profile: "Domain Controller" });
    expect(getAdapter("acme")?.profile).toBe("Domain Controller");
  });
});

// The live path branches on fleetMode() and drives the FleetService RPCs; the
// client and mode are stubbed above so no real network is needed.
describe("adapters store (live)", () => {
  beforeEach(() => {
    currentMode = "live";
    listAdapters.mockReset().mockResolvedValue({
      items: [
        {
          challenges: ["http-01"],
          enabled: true,
          endpoint: "https://mgr/acme",
          gpoTemplate: "",
          kind: "acme",
          name: "ACME (RFC 8555)",
          profile: "TLS Server",
        },
      ],
    });
    setAdapterEnabled.mockReset().mockResolvedValue({});
  });
  afterEach(() => vi.clearAllMocks());

  it("setEnabled calls the RPC with the adapter name (not kind) and refetches", async () => {
    // Load the live catalog so the kind -> name lookup has data.
    await setEnabled("acme", false);

    expect(setAdapterEnabled).toHaveBeenCalledTimes(1);
    expect(setAdapterEnabled.mock.calls[0][0]).toEqual({
      enabled: false,
      name: "ACME (RFC 8555)",
    });
    // One refetch after the write.
    expect(listAdapters).toHaveBeenCalled();
  });

  it("surfaces an inline error when the adapter is not loaded", async () => {
    const res = await setEnabled("scep", true);
    expect(res.ok).toBe(false);
    expect(res.reason).toBeTruthy();
    expect(setAdapterEnabled).not.toHaveBeenCalled();
  });

  it("surfaces an RPC error inline rather than throwing", async () => {
    setAdapterEnabled.mockRejectedValueOnce(new Error("admin level required"));
    const res = await setEnabled("acme", false);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("admin level required");
  });
});
