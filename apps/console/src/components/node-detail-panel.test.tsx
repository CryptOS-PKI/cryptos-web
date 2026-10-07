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

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NodeDetailPanel } from "@/components/node-detail-panel";
import { __resetNodes, getNode } from "@/lib/nodes";

let level: "admin" | "operator" | "viewer" = "admin";
vi.mock("@/context/auth", () => ({
  useOptionalAuth: () => ({
    operator: { commonName: "op@acme.example", level, serial: "AA" },
    status: "authenticated",
  }),
}));

const rootNode = () => getNode("acme-root-01")!;

const renderPanel = (onRenamed = vi.fn()) => {
  render(
    <MemoryRouter>
      <NodeDetailPanel node={rootNode()} onRenamed={onRenamed} />
    </MemoryRouter>,
  );
  return { onRenamed };
};

describe("NodeDetailPanel escrow actions", () => {
  beforeEach(() => {
    level = "admin";
    __resetNodes();
  });

  it("shows Rename, Export/Import key, Decommission and Reboot actions to an admin", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /^rename/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export key/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import key/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decommission/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reboot/i })).toBeInTheDocument();
  });

  it("hides rename, escrow, decommission and reboot actions from a non-admin operator", () => {
    level = "operator";
    renderPanel();
    expect(screen.queryByRole("button", { name: /^rename/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export key/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /import key/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /decommission/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^reboot/i })).not.toBeInTheDocument();
  });

  it("labels the reboot action plainly when no reboot is pending", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /^reboot…$/i })).toBeInTheDocument();
  });

  it("calls out a pending reboot on the action label when reboot_required is set", () => {
    render(
      <MemoryRouter>
        <NodeDetailPanel node={{ ...rootNode(), rebootRequired: true }} onRenamed={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /reboot needed…/i })).toBeInTheDocument();
  });
});

describe("NodeDetailPanel reboot action", () => {
  beforeEach(() => {
    level = "admin";
    __resetNodes();
  });

  it("opens the reboot dialog naming the node's CA CN", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^reboot/i }));
    const dialog = screen.getByRole("dialog", { name: /reboot node/i });
    expect(within(dialog).getByText(rootNode().cn)).toBeInTheDocument();
  });
});

describe("NodeDetailPanel rename action", () => {
  beforeEach(() => {
    level = "admin";
    __resetNodes();
  });

  it("opens the rename dialog and reports the new name on success", async () => {
    const { onRenamed } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^rename/i }));

    const dialog = screen.getByRole("dialog", { name: /rename node/i });
    fireEvent.change(within(dialog).getByLabelText(/new name/i), {
      target: { value: "acme-root-99" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^rename$/i }));

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith("acme-root-99"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(getNode("acme-root-99")).toBeDefined();
  });
});
