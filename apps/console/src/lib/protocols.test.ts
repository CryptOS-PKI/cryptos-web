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
import type { Node } from "@/lib/mock";
import { __resetNodes, getNode } from "@/lib/nodes";
import * as nodesMod from "@/lib/nodes";
import {
  eligibleForProtocols,
  ineligibleReason,
  nodeProtocolRows,
  PROTOCOLS,
  protocolInfo,
  switchNodeProtocol,
} from "@/lib/protocols";

import { ServiceProtocol } from "@cryptos-pki/api-client/cryptos/node/v1/status_pb";

const node = (overrides: Partial<Node>): Node => ({
  address: "10.0.0.1:8443",
  bootCount: 1,
  cn: "Test CA",
  fleetManager: { linked: true },
  identityState: "ESTABLISHED",
  issued: 0,
  issuer: "self-signed",
  name: "test-node",
  revoked: 0,
  role: "issuing",
  tpm: "TPM · sealed",
  uptime: "1d",
  ...overrides,
});

describe("PROTOCOLS catalog", () => {
  it("marks ACME and EST implemented, SCEP and Windows autoenrollment not", () => {
    expect(protocolInfo("acme")?.implemented).toBe(true);
    expect(protocolInfo("est")?.implemented).toBe(true);
    expect(protocolInfo("scep")?.implemented).toBe(false);
    expect(protocolInfo("ms-autoenroll")?.implemented).toBe(false);
  });

  it("has no entry for a route the catalog doesn't know", () => {
    expect(protocolInfo("nope")).toBeUndefined();
  });

  it("carries the ServiceProtocol enum value only for implemented protocols", () => {
    expect(protocolInfo("acme")?.serviceProtocol).toBe(ServiceProtocol.ACME);
    expect(protocolInfo("est")?.serviceProtocol).toBe(ServiceProtocol.EST);
    expect(protocolInfo("scep")?.serviceProtocol).toBeUndefined();
  });

  it("lists every protocol route exactly once", () => {
    expect(PROTOCOLS.map((p) => p.kind).sort()).toEqual(["acme", "est", "ms-autoenroll", "scep"]);
  });
});

describe("eligibleForProtocols", () => {
  it("is true only for an ESTABLISHED issuing node", () => {
    expect(eligibleForProtocols(node({ identityState: "ESTABLISHED", role: "issuing" }))).toBe(
      true,
    );
  });

  it("is false for a root or intermediate, regardless of state", () => {
    expect(eligibleForProtocols(node({ role: "root" }))).toBe(false);
    expect(eligibleForProtocols(node({ role: "intermediate" }))).toBe(false);
  });

  it("is false for an issuing node that is not established", () => {
    expect(eligibleForProtocols(node({ identityState: "AWAITING_CERT", role: "issuing" }))).toBe(
      false,
    );
    expect(eligibleForProtocols(node({ identityState: "REVOKED", role: "issuing" }))).toBe(false);
  });
});

describe("ineligibleReason", () => {
  it("names the role for a root or intermediate", () => {
    expect(ineligibleReason(node({ role: "root" }))).toMatch(/root ca/i);
    expect(ineligibleReason(node({ role: "intermediate" }))).toMatch(/intermediate ca/i);
  });

  it("names the state for an issuing node that cannot serve yet", () => {
    expect(ineligibleReason(node({ identityState: "AWAITING_CERT", role: "issuing" }))).toMatch(
      /awaiting_cert/i,
    );
    expect(ineligibleReason(node({ identityState: "REVOKED", role: "issuing" }))).toMatch(
      /revoked/i,
    );
  });

  it("is undefined for an eligible node", () => {
    expect(
      ineligibleReason(node({ identityState: "ESTABLISHED", role: "issuing" })),
    ).toBeUndefined();
  });
});

describe("nodeProtocolRows", () => {
  it("is empty for a protocol with no Pki block (SCEP, Windows autoenrollment)", () => {
    expect(nodeProtocolRows([node({})], "scep")).toEqual([]);
    expect(nodeProtocolRows([node({})], "ms-autoenroll")).toEqual([]);
  });

  it("reads configured/running/rebootPending from the node's reported status", () => {
    const n = node({
      protocols: [{ configured: true, protocol: "acme", rebootPending: true, running: false }],
    });
    const [row] = nodeProtocolRows([n], "acme");
    expect(row).toMatchObject({
      configured: true,
      eligible: true,
      rebootPending: true,
      running: false,
    });
  });

  it("defaults to not configured/not running for a node that reports nothing for the protocol", () => {
    const [row] = nodeProtocolRows([node({ protocols: [] })], "acme");
    expect(row).toMatchObject({ configured: false, rebootPending: false, running: false });
  });

  it("carries eligible false for a node that can't serve, independent of its reported status", () => {
    const [row] = nodeProtocolRows([node({ role: "root" })], "acme");
    expect(row.eligible).toBe(false);
  });
});

describe("switchNodeProtocol", () => {
  beforeEach(() => __resetNodes());
  afterEach(() => vi.restoreAllMocks());

  it("mutates the mock node's reported status and leaves it reboot-pending", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const target = getNode("acme-issuing-01");
    if (!target) throw new Error("fixture node missing");

    await switchNodeProtocol(target, "acme", false);

    expect(getNode("acme-issuing-01")?.protocols).toContainEqual({
      configured: false,
      protocol: "acme",
      rebootPending: true,
      running: true,
    });
  });

  it("calls SetNodeProtocol and refetches the fleet in live mode", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const setNodeProtocol = vi.fn().mockResolvedValue({ generation: 2n, requiresReboot: true });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      setNodeProtocol,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    const refresh = vi.spyOn(nodesMod, "refreshLiveNodes").mockResolvedValue();

    const target = node({ name: "live-issuing-01" });
    await switchNodeProtocol(target, "est", true);

    expect(setNodeProtocol).toHaveBeenCalledWith({
      enabled: true,
      nodeName: "live-issuing-01",
      protocol: ServiceProtocol.EST,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("surfaces a live failure to the caller instead of swallowing it", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      setNodeProtocol: vi.fn().mockRejectedValue(new Error("node refused")),
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    await expect(switchNodeProtocol(node({ name: "x" }), "acme", true)).rejects.toThrow(
      "node refused",
    );
  });
});
