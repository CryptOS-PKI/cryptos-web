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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentKeysPage } from "@/pages/agent-keys";

const useAuth = vi.fn();
vi.mock("@/context/auth", () => ({ useAuth: () => useAuth() }));

const listMcpKeys = vi.fn();
vi.mock("@/lib/mcp-keys", () => ({ listMcpKeys: (...a: unknown[]) => listMcpKeys(...a) }));

// The dialogs are covered by their own tests; stub them so the page test stays
// on listing, scope and gating.
vi.mock("@/components/mcp-key-create-dialog", () => ({
  McpKeyCreateDialog: (): ReactNode => <div>create-dialog</div>,
}));
vi.mock("@/components/mcp-key-revoke-dialog", () => ({
  McpKeyRevokeDialog: ({ target }: { target: { label: string } }): ReactNode => (
    <div>revoke-dialog:{target.label}</div>
  ),
}));

const own = {
  clientName: "Example Agent",
  createdAt: "2026-09-01T00:00:00Z",
  id: "key-1",
  label: "build agent",
  lastUsedAt: "2026-09-02T10:00:00Z",
  levelCeiling: "operator",
  operatorCn: "operator@example.org",
  operatorSerial: "0A:BC",
  revoked: false,
  revokedAt: "",
};
const revoked = {
  ...own,
  clientName: "",
  id: "key-2",
  label: "old laptop",
  lastUsedAt: "",
  revoked: true,
  revokedAt: "2026-09-03T00:00:00Z",
};
const other = { ...own, id: "key-3", label: "ci runner", operatorCn: "second@example.org" };

describe("AgentKeysPage", () => {
  beforeEach(() => {
    listMcpKeys.mockReset();
    listMcpKeys.mockImplementation(({ all }: { all: boolean }) =>
      Promise.resolve(all ? [own, revoked, other] : [own, revoked]),
    );
  });

  it("lists the caller's keys with client, ceiling, last use and status", async () => {
    useAuth.mockReturnValue({ operator: { level: "operator" } });
    render(<AgentKeysPage />);

    expect(await screen.findByText("build agent")).toBeInTheDocument();
    expect(screen.getByText("Example Agent")).toBeInTheDocument();
    expect(screen.getByText("old laptop")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("revoked")).toBeInTheDocument();
    expect(screen.getByText("never")).toBeInTheDocument();
    expect(listMcpKeys).toHaveBeenCalledWith({ all: false });
  });

  it("offers Revoke on active keys only", async () => {
    useAuth.mockReturnValue({ operator: { level: "operator" } });
    render(<AgentKeysPage />);
    await screen.findByText("build agent");

    const buttons = screen.getAllByRole("button", { name: /revoke/i });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(screen.getByText("revoke-dialog:build agent")).toBeInTheDocument();
  });

  it("lets any operator create a key", async () => {
    useAuth.mockReturnValue({ operator: { level: "viewer" } });
    render(<AgentKeysPage />);
    await screen.findByText("build agent");

    fireEvent.click(screen.getByRole("button", { name: /create key/i }));
    expect(screen.getByText("create-dialog")).toBeInTheDocument();
  });

  it("lets an admin switch to every operator's keys", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    render(<AgentKeysPage />);
    await screen.findByText("build agent");
    expect(screen.queryByText("ci runner")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/all operators/i));

    expect(await screen.findByText("ci runner")).toBeInTheDocument();
    expect(screen.getByText("second@example.org")).toBeInTheDocument();
    expect(listMcpKeys).toHaveBeenLastCalledWith({ all: true });
  });

  it("does not offer the all-keys switch to a non-admin", async () => {
    useAuth.mockReturnValue({ operator: { level: "operator" } });
    render(<AgentKeysPage />);
    await screen.findByText("build agent");

    expect(screen.queryByLabelText(/all operators/i)).not.toBeInTheDocument();
  });

  it("explains the empty state", async () => {
    listMcpKeys.mockResolvedValue([]);
    useAuth.mockReturnValue({ operator: { level: "operator" } });
    render(<AgentKeysPage />);

    await waitFor(() => expect(screen.getByText(/no agent keys yet/i)).toBeInTheDocument());
  });

  it("shows a load failure", async () => {
    listMcpKeys.mockRejectedValue(new Error("manager unreachable"));
    useAuth.mockReturnValue({ operator: { level: "operator" } });
    render(<AgentKeysPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("manager unreachable");
  });
});
