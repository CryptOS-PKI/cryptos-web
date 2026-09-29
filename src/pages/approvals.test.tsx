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

import type { ReactNode } from "react";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApprovalsPage } from "@/pages/approvals";

const useAuth = vi.fn();
vi.mock("@/context/auth", () => ({ useAuth: () => useAuth() }));

const listApprovals = vi.fn();
vi.mock("@/lib/approvals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/approvals")>()),
  listApprovals: (...a: unknown[]) => listApprovals(...a),
}));

// The dialog is covered by its own test; stub it so the page test stays on
// listing, filtering, gating and the deep link.
vi.mock("@/components/approval-decide-dialog", () => ({
  ApprovalDecideDialog: ({
    approve,
    target,
  }: {
    approve: boolean;
    target: { id: string };
  }): ReactNode => (
    <div>
      decide-dialog:{approve ? "approve" : "deny"}:{target.id}
    </div>
  ),
}));

const base = {
  createdAt: "2026-09-01T10:00:00Z",
  decidedAt: "",
  decidedByCn: "",
  decidedBySerial: "",
  expiresAt: "2026-09-01T10:15:00Z",
  keyId: "key-1",
  requestDigest: "ab".repeat(32),
  requestedByCn: "operator@example.org",
  requestedBySerial: "0A:BC",
};
const revoke = {
  ...base,
  id: "ap-1",
  requiredLevel: "operator",
  status: "pending",
  summary: "Revoke certificate 0a1b on issuing-1",
  tool: "cert_revoke",
};
const decommission = {
  ...base,
  id: "ap-2",
  keyId: "key-2",
  requestedByCn: "second@example.org",
  requiredLevel: "admin",
  status: "pending",
  summary: "Decommission node issuing-2",
  tool: "node_decommission",
};
const approved = {
  ...base,
  decidedAt: "2026-08-30T09:05:00Z",
  decidedByCn: "admin@example.org",
  id: "ap-0",
  requiredLevel: "operator",
  status: "approved",
  summary: "Issue a leaf for svc.example.org",
  tool: "cert_issue_from_csr",
};

const renderAt = (path = "/approvals") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ApprovalsPage />
    </MemoryRouter>,
  );

const rowOf = (text: string): HTMLElement => {
  const row = screen.getByText(text).closest("tr");
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};

describe("ApprovalsPage", () => {
  beforeEach(() => {
    listApprovals.mockReset();
    listApprovals.mockImplementation(({ status }: { status: string }) =>
      Promise.resolve(
        [revoke, decommission, approved].filter((a) => status === "" || a.status === status),
      ),
    );
  });

  it("lists pending approvals by default with every column", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    renderAt();

    expect(await screen.findByText("Revoke certificate 0a1b on issuing-1")).toBeInTheDocument();
    expect(listApprovals).toHaveBeenCalledWith({ status: "pending" });
    const row = rowOf("Revoke certificate 0a1b on issuing-1");
    expect(row).toHaveTextContent("cert_revoke");
    expect(row).toHaveTextContent("operator@example.org");
    expect(row).toHaveTextContent("key-1");
    expect(row).toHaveTextContent("operator");
    expect(row).toHaveTextContent("2026-09-01 10:00");
    expect(row).toHaveTextContent("2026-09-01 10:15");
    expect(row).toHaveTextContent("pending");
    expect(screen.getByText("Decommission node issuing-2")).toBeInTheDocument();
    expect(screen.queryByText("Issue a leaf for svc.example.org")).not.toBeInTheDocument();
  });

  it("switches the filter to every status", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    renderAt();
    await screen.findByText("Revoke certificate 0a1b on issuing-1");

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "" } });

    expect(await screen.findByText("Issue a leaf for svc.example.org")).toBeInTheDocument();
    expect(listApprovals).toHaveBeenLastCalledWith({ status: "" });
    expect(rowOf("Issue a leaf for svc.example.org")).toHaveTextContent("admin@example.org");
  });

  it("opens the approve confirmation for that approval", async () => {
    useAuth.mockReturnValue({ operator: { level: "operator" } });
    renderAt();
    await screen.findByText("Revoke certificate 0a1b on issuing-1");

    fireEvent.click(
      within(rowOf("Revoke certificate 0a1b on issuing-1")).getByRole("button", {
        name: /approve/i,
      }),
    );

    expect(screen.getByText("decide-dialog:approve:ap-1")).toBeInTheDocument();
  });

  it("opens the deny confirmation for that approval", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    renderAt();
    await screen.findByText("Decommission node issuing-2");

    fireEvent.click(
      within(rowOf("Decommission node issuing-2")).getByRole("button", { name: /deny/i }),
    );

    expect(screen.getByText("decide-dialog:deny:ap-2")).toBeInTheDocument();
  });

  it("disables the buttons below the required level", async () => {
    useAuth.mockReturnValue({ operator: { level: "operator" } });
    renderAt();
    await screen.findByText("Decommission node issuing-2");

    const high = within(rowOf("Decommission node issuing-2"));
    expect(high.getByRole("button", { name: /approve/i })).toBeDisabled();
    expect(high.getByRole("button", { name: /deny/i })).toBeDisabled();
    const low = within(rowOf("Revoke certificate 0a1b on issuing-1"));
    expect(low.getByRole("button", { name: /approve/i })).toBeEnabled();
    expect(low.getByRole("button", { name: /deny/i })).toBeEnabled();
  });

  it("disables every decision for a viewer", async () => {
    useAuth.mockReturnValue({ operator: { level: "viewer" } });
    renderAt();
    await screen.findByText("Revoke certificate 0a1b on issuing-1");

    for (const button of screen.getAllByRole("button", { name: /approve|deny/i })) {
      expect(button).toBeDisabled();
    }
  });

  it("disables the buttons once an approval is no longer pending", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    renderAt();
    await screen.findByText("Revoke certificate 0a1b on issuing-1");
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "" } });
    await screen.findByText("Issue a leaf for svc.example.org");

    const done = within(rowOf("Issue a leaf for svc.example.org"));
    expect(done.getByRole("button", { name: /approve/i })).toBeDisabled();
    expect(done.getByRole("button", { name: /deny/i })).toBeDisabled();
  });

  it("focuses the approval a deep link names, whatever its status", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    renderAt("/approvals?id=ap-0");

    expect(await screen.findByText("Issue a leaf for svc.example.org")).toBeInTheDocument();
    expect(listApprovals).toHaveBeenCalledWith({ status: "" });
    expect(rowOf("Issue a leaf for svc.example.org")).toHaveAttribute("aria-current", "true");
    expect(rowOf("Revoke certificate 0a1b on issuing-1")).not.toHaveAttribute("aria-current");
  });

  it("says so when the deep-linked approval is not there", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    renderAt("/approvals?id=ap-404");

    expect(await screen.findByText(/ap-404 was not found/i)).toBeInTheDocument();
  });

  it("explains the empty state", async () => {
    listApprovals.mockResolvedValue([]);
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    renderAt();

    await waitFor(() => expect(screen.getByText(/no approvals/i)).toBeInTheDocument());
  });

  it("shows a load failure", async () => {
    listApprovals.mockRejectedValue(new Error("manager unreachable"));
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    renderAt();

    expect(await screen.findByRole("alert")).toHaveTextContent("manager unreachable");
  });
});
