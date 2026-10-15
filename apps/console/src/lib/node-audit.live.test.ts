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

const listNodeAuditEvents = vi.fn(() =>
  Promise.resolve({
    entries: [
      {
        actorSubject: "CN=operator@acme.example",
        details: {},
        entrySha256Hex: "deadbeef",
        outcome: "OK",
        rpcMethod: "/cryptos.node.v1.NodeService/RevokeCertificate",
        seq: 1n,
        summary: "revoked 0a1b",
        target: "0a1b",
        ts: "2026-07-01T00:00:00Z",
      },
    ],
    nextPageToken: "tok2",
  }),
);
const verifyNodeAuditChain = vi.fn(() =>
  Promise.resolve({ entryCount: 1n, firstBrokenSequence: 0n, intact: true, reason: "" }),
);
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({ listNodeAuditEvents, verifyNodeAuditChain }),
}));

import {
  listNodeAuditEvents as listNodeAuditEventsLib,
  verifyNodeAuditChain as verifyNodeAuditChainLib,
} from "@/lib/node-audit";

describe("listNodeAuditEvents live path", () => {
  beforeEach(() => {
    listNodeAuditEvents.mockClear();
    vi.stubEnv("VITE_FLEET_MODE", "live");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("forwards the node name and filters, and flattens the manager's response", async () => {
    const page = await listNodeAuditEventsLib("acme-issuing-01", { actor: "operator" });

    expect(listNodeAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "operator", nodeName: "acme-issuing-01" }),
    );
    expect(page.nextPageToken).toBe("tok2");
    expect(page.entries).toEqual([
      {
        actorSubject: "CN=operator@acme.example",
        entrySha256Hex: "deadbeef",
        outcome: "OK",
        rpcMethod: "/cryptos.node.v1.NodeService/RevokeCertificate",
        seq: 1,
        summary: "revoked 0a1b",
        target: "0a1b",
        ts: "2026-07-01T00:00:00Z",
      },
    ]);
  });

  it("falls back to UNSPECIFIED for an outcome the web doesn't know", async () => {
    listNodeAuditEvents.mockResolvedValueOnce({
      entries: [
        {
          actorSubject: "",
          details: {},
          entrySha256Hex: "",
          outcome: "SOMETHING_NEW",
          rpcMethod: "",
          seq: 2n,
          summary: "",
          target: "",
          ts: "",
        },
      ],
      nextPageToken: "",
    });
    const page = await listNodeAuditEventsLib("acme-issuing-01");
    expect(page.entries[0].outcome).toBe("UNSPECIFIED");
  });
});

describe("verifyNodeAuditChain live path", () => {
  beforeEach(() => {
    verifyNodeAuditChain.mockClear();
    vi.stubEnv("VITE_FLEET_MODE", "live");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("forwards the node name and returns the node's result", async () => {
    const result = await verifyNodeAuditChainLib("acme-issuing-01");
    expect(verifyNodeAuditChain).toHaveBeenCalledWith(
      expect.objectContaining({ nodeName: "acme-issuing-01" }),
    );
    expect(result).toEqual({ entryCount: 1, firstBrokenSequence: 0, intact: true, reason: "" });
  });
});
