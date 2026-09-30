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

import type { MachineConfig } from "@/gen/fleet/cryptos/v1/config_pb";
import { applyNodeConfig, formatList, getNodeConfig, parseList } from "@/lib/config";

const getNodeConfigRpc = vi.fn();
const applyNodeConfigRpc = vi.fn();
let mode: "live" | "mock" = "live";

vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({
    applyNodeConfig: applyNodeConfigRpc,
    getNodeConfig: getNodeConfigRpc,
  }),
}));
vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => mode }));

const fetchedConfig = (): MachineConfig =>
  ({
    apiVersion: "cryptos.dev/v1alpha1",
    kind: "MachineConfig",
    role: { kind: "intermediate" },
    pki: { rootKeyAlg: "ECDSA-P384", revocationBaseUrl: "http://pki.acme/old/crl" },
    management: { managerCn: "fm-op", trustPem: "trust-pem", operatorSurfaceReadonly: false },
  }) as unknown as MachineConfig;

describe("getNodeConfig (live)", () => {
  beforeEach(() => {
    mode = "live";
    getNodeConfigRpc.mockReset().mockResolvedValue({ config: fetchedConfig() });
  });

  it("fetches the node's full config via the fleet client", async () => {
    const config = await getNodeConfig("acme-int-01");
    expect(getNodeConfigRpc).toHaveBeenCalledWith({ nodeName: "acme-int-01" });
    expect(config.management?.managerCn).toBe("fm-op");
    expect(config.pki?.revocationBaseUrl).toBe("http://pki.acme/old/crl");
  });

  it("refuses to run in mock mode rather than silently no-op", async () => {
    mode = "mock";
    await expect(getNodeConfig("acme-int-01")).rejects.toThrow(/live mode/i);
    expect(getNodeConfigRpc).not.toHaveBeenCalled();
  });
});

describe("applyNodeConfig (live)", () => {
  beforeEach(() => {
    mode = "live";
    applyNodeConfigRpc.mockReset().mockResolvedValue({ generation: 9n, requiresReboot: true });
  });

  it("sends the full config to the fleet client and surfaces requiresReboot", async () => {
    const full = fetchedConfig();
    const result = await applyNodeConfig("acme-int-01", full);
    expect(applyNodeConfigRpc).toHaveBeenCalledWith({ nodeName: "acme-int-01", config: full });
    expect(result.requiresReboot).toBe(true);
    expect(result.generation).toBe(9);
  });

  it("refuses to run in mock mode rather than silently no-op", async () => {
    mode = "mock";
    await expect(applyNodeConfig("acme-int-01", fetchedConfig())).rejects.toThrow(/live mode/i);
    expect(applyNodeConfigRpc).not.toHaveBeenCalled();
  });
});

describe("parseList / formatList", () => {
  it("splits on commas and whitespace and drops empty entries", () => {
    expect(parseList(" 10.0.0.53, 10.0.1.53\n  pki.example.org ,, ")).toEqual([
      "10.0.0.53",
      "10.0.1.53",
      "pki.example.org",
    ]);
    expect(parseList("   ")).toEqual([]);
  });

  it("formats a list so parseList reads it back unchanged", () => {
    const list = ["10.0.0.53", "10.0.1.53"];
    expect(formatList(list)).toBe("10.0.0.53, 10.0.1.53");
    expect(parseList(formatList(list))).toEqual(list);
    expect(formatList(undefined)).toBe("");
  });
});
