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
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetNodes, getNode } from "@/lib/nodes";
import { RootDetailPage } from "@/pages/root-detail";

let level: "admin" | "operator" | "viewer" = "admin";
vi.mock("@/context/auth", () => ({
  useOptionalAuth: () => ({
    operator: { commonName: "op@acme.example", level, serial: "AA" },
    status: "authenticated",
  }),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RootDetailPage />} path="/root/:name" />
        <Route element={<div>roots list</div>} path="/root" />
      </Routes>
    </MemoryRouter>,
  );

describe("RootDetailPage", () => {
  beforeEach(async () => {
    level = "admin";
    await __resetNodes();
  });

  it("shows a root's connection, config, and ceremony", () => {
    renderAt("/root/acme-root-01");
    expect(screen.getByText("acme-root-01")).toBeInTheDocument();
    expect(screen.getByText(/connection/i)).toBeInTheDocument();
    expect(screen.getByText("fm-client@acme-root-01")).toBeInTheDocument();
    expect(screen.getByText(/config/i)).toBeInTheDocument();
    expect(screen.getByText(/ceremony/i)).toBeInTheDocument();
  });

  it("redirects a non-root node to the roots list", () => {
    renderAt("/root/acme-issuing-01"); // an issuing node, not a root
    expect(screen.getByText("roots list")).toBeInTheDocument();
  });

  it("hides the rename action from a non-admin operator", () => {
    level = "operator";
    renderAt("/root/acme-root-01");
    expect(screen.queryByRole("button", { name: /^rename/i })).not.toBeInTheDocument();
  });

  it("renames a root and moves to its new URL", async () => {
    renderAt("/root/acme-root-01");
    fireEvent.click(screen.getByRole("button", { name: /^rename/i }));

    const dialog = screen.getByRole("dialog", { name: /rename node/i });
    fireEvent.change(within(dialog).getByLabelText(/new name/i), {
      target: { value: "acme-root-99" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^rename$/i }));

    await waitFor(() => expect(screen.getByText("acme-root-99")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getNode("acme-root-01")).toBeUndefined();
  });
});
