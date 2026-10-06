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

import { mockNodes } from "@/lib/mock";
import {
  __resetNodes,
  addNode,
  chainToRoot,
  fromSummary,
  getNode,
  nodesList,
  renameNode,
} from "@/lib/nodes";

import type { NodeSummary } from "@cryptos-pki/api-client/cryptos/fleet/v1/fleet_pb";

// A NodeSummary carries only the fields the manager's read-through view sets;
// the mapper defaults the rest. Cast a partial rather than build the full
// protobuf message shape, since fromSummary reads only these fields.
const summary = (fields: Partial<NodeSummary>): NodeSummary => fields as NodeSummary;

describe("nodes store", () => {
  beforeEach(() => __resetNodes());

  it("seeds from the mock fixture", () => {
    expect(nodesList().length).toBe(mockNodes.length);
    expect(getNode("acme-root-01")?.role).toBe("root");
  });

  it("nodesList reference is stable between reads", () => {
    expect(nodesList()).toBe(nodesList());
  });

  it("addNode appends and getNode resolves it; reference changes on mutation", () => {
    const before = nodesList();
    addNode({
      name: "acme-issuing-x9",
      address: "10.20.9.9:8443",
      role: "issuing",
      identityState: "ESTABLISHED",
      cn: "ACME Issuing CA X9",
      parentCn: "ACME Intermediate CA G1",
      issuer: "ACME Intermediate CA G1",
      issued: 0,
      revoked: 0,
      tpm: "UNAVAILABLE · nodeID",
      fleetManager: { linked: true, peerCertDays: 1 },
      bootCount: 1,
      uptime: "0d 01h",
    });
    expect(nodesList()).not.toBe(before);
    expect(nodesList().length).toBe(before.length + 1);
    expect(getNode("acme-issuing-x9")?.cn).toBe("ACME Issuing CA X9");
  });
});

describe("fromSummary", () => {
  it("derives parentCn from issuer for a subordinate (issuer !== cn)", () => {
    const node = fromSummary(
      summary({
        name: "pki-inter",
        cn: "ACME Intermediate CA",
        issuer: "ACME Root CA",
        role: "intermediate",
      }),
    );
    expect(node.parentCn).toBe("ACME Root CA");
  });

  it("leaves a self-signed root parentless (issuer === cn)", () => {
    const node = fromSummary(
      summary({ name: "pki-root", cn: "ACME Root CA", issuer: "ACME Root CA", role: "root" }),
    );
    expect(node.parentCn).toBeUndefined();
  });

  it("leaves parentCn undefined when issuer is empty", () => {
    const node = fromSummary(summary({ name: "pki-root", cn: "ACME Root CA", issuer: "" }));
    expect(node.parentCn).toBeUndefined();
  });

  it("passes through the stable id", () => {
    expect(fromSummary(summary({ id: "0198c2ac-6e3f-7e3e-9b2b-9f6a7a9d2c31", name: "a" })).id).toBe(
      "0198c2ac-6e3f-7e3e-9b2b-9f6a7a9d2c31",
    );
  });

  it("marks the node linked only when health is UP (1)", () => {
    expect(fromSummary(summary({ name: "up", health: 1 })).fleetManager.linked).toBe(true);
    expect(fromSummary(summary({ name: "down", health: 2 })).fleetManager.linked).toBe(false);
  });

  it("passes through a known identityState and defaults an unknown one", () => {
    expect(fromSummary(summary({ name: "a", identityState: "ESTABLISHED" })).identityState).toBe(
      "ESTABLISHED",
    );
    expect(fromSummary(summary({ name: "b", identityState: "BOGUS" })).identityState).toBe(
      "AWAITING_CERT",
    );
  });
});

describe("renameNode", () => {
  beforeEach(() => __resetNodes());

  afterEach(() => {
    __resetNodes();
    vi.restoreAllMocks();
  });

  it("refuses an invalid name before any store change or round trip", async () => {
    const before = getNode("acme-root-01")!;
    await expect(renameNode(before, "Not Valid")).rejects.toThrow(/RFC 1123|lowercase/i);
    expect(getNode("acme-root-01")).toBeDefined();
  });

  it("no-ops when the new name is the current name", async () => {
    const node = getNode("acme-root-01")!;
    await expect(renameNode(node, "acme-root-01")).resolves.toBe("acme-root-01");
  });

  it("renames the fixture node in mock mode so every view follows it", async () => {
    const node = getNode("acme-root-01")!;
    await expect(renameNode(node, "acme-root-99")).resolves.toBe("acme-root-99");
    expect(getNode("acme-root-01")).toBeUndefined();
    expect(getNode("acme-root-99")?.cn).toBe(node.cn);
  });

  it("refuses a name another node already has, in mock mode", async () => {
    const node = getNode("acme-root-01")!;
    const other = getNode("acme-intermediate-01")!;
    await expect(renameNode(node, other.name)).rejects.toThrow(/already has the name/i);
  });

  it("routes through the manager with the node's id and refetches the fleet in live mode", async () => {
    // Captured while still in the default mock mode, before the spy below
    // switches the seam: the live store starts empty, so a lookup after the
    // switch would find nothing.
    const node = { ...getNode("acme-root-01")!, id: "0198c2ac-6e3f-7e3e-9b2b-9f6a7a9d2c31" };

    const modeMod = await import("@/lib/fleet/mode");
    const clientMod = await import("@/lib/fleet/client");
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const renameNodeRpc = vi.fn().mockResolvedValue({ node: { name: "acme-root-99" } });
    const listNodesRpc = vi.fn().mockResolvedValue({
      nodes: [
        {
          address: node.address,
          cn: node.cn,
          health: 1,
          healthDetail: "",
          id: node.id,
          identityState: node.identityState,
          issuer: node.issuer,
          name: "acme-root-99",
          role: node.role,
        },
      ],
    });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      listNodes: listNodesRpc,
      renameNode: renameNodeRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    await expect(renameNode(node, "acme-root-99")).resolves.toBe("acme-root-99");
    expect(renameNodeRpc).toHaveBeenCalledWith({
      newName: "acme-root-99",
      nodeId: "0198c2ac-6e3f-7e3e-9b2b-9f6a7a9d2c31",
    });
    // The fleet was refetched: the live store now has the renamed node.
    expect(listNodesRpc).toHaveBeenCalled();
    expect(getNode("acme-root-99")?.id).toBe("0198c2ac-6e3f-7e3e-9b2b-9f6a7a9d2c31");
  });

  it("surfaces a name-taken refusal from the manager in live mode", async () => {
    const node = { ...getNode("acme-root-01")!, id: "0198c2ac-6e3f-7e3e-9b2b-9f6a7a9d2c31" };

    const modeMod = await import("@/lib/fleet/mode");
    const clientMod = await import("@/lib/fleet/client");
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      renameNode: vi.fn().mockRejectedValue(new Error("another node is already named")),
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    await expect(renameNode(node, "acme-root-99")).rejects.toThrow(/already named/);
  });
});

describe("chainToRoot", () => {
  it("returns the ordered chain from the root to the node", () => {
    const chain = chainToRoot(getNode("acme-issuing-01")!).map((n) => n.name);
    expect(chain[0]).toBe("acme-root-01");
    expect(chain[chain.length - 1]).toBe("acme-issuing-01");
    expect(chain).toContain("acme-intermediate-01");
  });

  it("returns a single element for a root", () => {
    expect(chainToRoot(getNode("acme-root-01")!).map((n) => n.name)).toEqual(["acme-root-01"]);
  });
});
