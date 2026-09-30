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

import { rekeyNode } from "@/lib/rekey";

const rekeyNodeRpc = vi.fn();
const listNodes = vi.fn();
const listCertificates = vi.fn();
let mode: "live" | "mock" = "live";

vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({
    listCertificates,
    listNodes,
    rekeyNode: rekeyNodeRpc,
  }),
}));
vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => mode }));

describe("rekeyNode (live)", () => {
  beforeEach(() => {
    mode = "live";
    rekeyNodeRpc.mockReset().mockResolvedValue({
      chainLen: 2,
      issuerCn: "ACME Intermediate CA",
      subjectCn: "ACME Issuing CA",
    });
    listNodes.mockReset().mockResolvedValue({ nodes: [] });
    listCertificates.mockReset().mockResolvedValue({ certificates: [] });
  });

  it("calls RekeyNode with the node and profile, then refetches nodes and certs", async () => {
    const result = await rekeyNode("acme-issuing-01", "sub-ca");
    expect(rekeyNodeRpc).toHaveBeenCalledWith({
      nodeName: "acme-issuing-01",
      profileName: "sub-ca",
    });
    expect(listNodes).toHaveBeenCalled();
    expect(listCertificates).toHaveBeenCalled();
    expect(result).toEqual({
      chainLen: 2,
      issuerCn: "ACME Intermediate CA",
      subjectCn: "ACME Issuing CA",
    });
  });

  it("propagates RPC errors instead of swallowing them", async () => {
    rekeyNodeRpc.mockRejectedValue(new Error("manager unreachable"));
    await expect(rekeyNode("acme-issuing-01", "sub-ca")).rejects.toThrow("manager unreachable");
  });

  it("refuses to run in mock mode rather than silently no-op", async () => {
    mode = "mock";
    await expect(rekeyNode("acme-issuing-01", "sub-ca")).rejects.toThrow(/live mode/i);
    expect(rekeyNodeRpc).not.toHaveBeenCalled();
  });
});
