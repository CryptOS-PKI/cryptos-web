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

import {
  __resetApprovals,
  APPROVALS_CHANGED,
  canDecide,
  decideApproval,
  listApprovals,
} from "@/lib/approvals";
import * as clientMod from "@/lib/fleet/client";
import * as modeMod from "@/lib/fleet/mode";

afterEach(() => {
  vi.restoreAllMocks();
  __resetApprovals();
});

const wireApproval = {
  createdAt: "2026-09-01T00:00:00Z",
  decidedAt: "",
  decidedByCn: "",
  decidedBySerial: "",
  expiresAt: "2026-09-01T00:15:00Z",
  id: "ap-1",
  keyId: "key-1",
  requestDigest: "ab".repeat(32),
  requestedByCn: "operator@example.org",
  requestedBySerial: "0A:BC",
  requiredLevel: "operator",
  status: "pending",
  summary: "Revoke certificate 0a1b on issuing-1",
  tool: "cert_revoke",
};

describe("canDecide", () => {
  it("needs a pending approval and a level at least the required one", () => {
    const row = { requiredLevel: "operator", status: "pending" };
    expect(canDecide("viewer", row)).toBe(false);
    expect(canDecide("operator", row)).toBe(true);
    expect(canDecide("admin", row)).toBe(true);
    expect(canDecide("admin", { requiredLevel: "admin", status: "pending" })).toBe(true);
    expect(canDecide("operator", { requiredLevel: "admin", status: "pending" })).toBe(false);
    expect(canDecide("admin", { ...row, status: "approved" })).toBe(false);
    expect(canDecide("admin", { ...row, status: "expired" })).toBe(false);
  });

  it("refuses a required level it does not recognise", () => {
    expect(canDecide("admin", { requiredLevel: "root", status: "pending" })).toBe(false);
  });
});

describe("approvals (live)", () => {
  it("lists through ListApprovals with the status filter", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const listApprovalsRpc = vi.fn().mockResolvedValue({ items: [wireApproval] });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      listApprovals: listApprovalsRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    const rows = await listApprovals({ status: "pending" });

    expect(listApprovalsRpc).toHaveBeenCalledWith({ status: "pending" });
    expect(rows).toEqual([wireApproval]);
  });

  it("decides through DecideApproval and announces the change", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const decided = { ...wireApproval, status: "denied" };
    const decideApprovalRpc = vi.fn().mockResolvedValue({ approval: decided });
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      decideApproval: decideApprovalRpc,
    } as unknown as ReturnType<typeof clientMod.fleetClient>);
    const changed = vi.fn();
    globalThis.addEventListener(APPROVALS_CHANGED, changed);

    const row = await decideApproval({ approve: false, id: "ap-1" });

    globalThis.removeEventListener(APPROVALS_CHANGED, changed);
    expect(decideApprovalRpc).toHaveBeenCalledWith({ approve: false, id: "ap-1" });
    expect(row.status).toBe("denied");
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("fails when the manager returns no approval", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    vi.spyOn(clientMod, "fleetClient").mockReturnValue({
      decideApproval: vi.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof clientMod.fleetClient>);

    await expect(decideApproval({ approve: true, id: "ap-1" })).rejects.toThrow(/no approval/);
  });
});

describe("approvals (mock)", () => {
  it("filters on status, with an empty status meaning all", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const all = await listApprovals({ status: "" });
    const pending = await listApprovals({ status: "pending" });

    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((a) => a.status === "pending")).toBe(true);
    expect(all.length).toBeGreaterThan(pending.length);
  });

  it("approves a pending approval, records the decider, and refuses a second decision", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    const [first] = await listApprovals({ status: "pending" });

    const decided = await decideApproval({ approve: true, id: first.id });

    expect(decided).toMatchObject({ id: first.id, status: "approved" });
    expect(decided.decidedByCn).not.toBe("");
    expect(decided.decidedAt).not.toBe("");
    await expect(decideApproval({ approve: false, id: first.id })).rejects.toThrow(/not pending/);
  });
});
