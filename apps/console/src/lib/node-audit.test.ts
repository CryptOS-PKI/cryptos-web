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

import { describe, expect, it } from "vitest";

import { listNodeAuditEvents, verifyNodeAuditChain } from "@/lib/node-audit";

describe("listNodeAuditEvents (mock mode)", () => {
  it("returns a deterministic demo log naming the node", async () => {
    const page = await listNodeAuditEvents("acme-issuing-01");
    expect(page.entries.length).toBeGreaterThan(0);
    expect(page.nextPageToken).toBe("");
    expect(page.entries.every((e) => e.summary.includes("acme-issuing-01"))).toBe(true);
  });

  it("orders entries oldest seq last is not assumed: seq values are present and unique", async () => {
    const page = await listNodeAuditEvents("acme-issuing-01");
    const seqs = page.entries.map((e) => e.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
  });
});

describe("verifyNodeAuditChain (mock mode)", () => {
  it("reports the demo log as intact", async () => {
    const result = await verifyNodeAuditChain("acme-issuing-01");
    expect(result.intact).toBe(true);
    expect(result.firstBrokenSequence).toBe(0);
    expect(result.reason).toBe("");
    expect(result.entryCount).toBeGreaterThan(0);
  });
});
