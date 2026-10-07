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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetNodes, getNode } from "@/lib/nodes";
import * as protocolsMod from "@/lib/protocols";
import { ProtocolDetailPage } from "@/pages/protocol-detail";

// switchNodeProtocol is exercised directly in lib/protocols.test.ts (mock and
// live paths); here it is spied on so this page's error rendering can be
// tested without disturbing the mock node list the rest of these tests read.
vi.mock("@/lib/protocols", async () => {
  const actual = await vi.importActual<typeof protocolsMod>("@/lib/protocols");
  return { ...actual, switchNodeProtocol: vi.fn(actual.switchNodeProtocol) };
});

let operatorLevel: "admin" | "viewer" = "admin";
vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    operator: { commonName: "op@acme.example", level: operatorLevel, serial: "AA" },
    status: "authenticated",
  }),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtocolDetailPage />} path="/protocols/:kind" />
        <Route element={<div>protocols list</div>} path="/protocols" />
      </Routes>
    </MemoryRouter>,
  );

const rowFor = (name: RegExp) => screen.getByRole("link", { name }).closest("tr") as HTMLElement;

describe("ProtocolDetailPage", () => {
  beforeEach(async () => {
    operatorLevel = "admin";
    await __resetNodes();
  });
  afterEach(() => vi.restoreAllMocks());

  it("redirects an unknown protocol to the list", () => {
    renderAt("/protocols/nope");
    expect(screen.getByText("protocols list")).toBeInTheDocument();
  });

  it("explains a not-implemented protocol instead of showing a table", () => {
    renderAt("/protocols/scep");
    expect(screen.getByRole("note")).toHaveTextContent(/not implemented/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("lists every node for an implemented protocol, with role/state for the ineligible", () => {
    renderAt("/protocols/acme");
    expect(within(rowFor(/^acme-issuing-01/)).getByText(/running/i)).toBeInTheDocument();
    expect(within(rowFor(/^acme-root-01/)).getByText(/don't serve/i)).toBeInTheDocument();
  });

  it("shows a reboot-pending node as configured but not yet running", () => {
    renderAt("/protocols/est");
    const row = rowFor(/^acme-issuing-02/);
    expect(within(row).getByText(/reboot/i)).toBeInTheDocument();
  });

  it("switches the protocol on an eligible node and reflects the change", async () => {
    renderAt("/protocols/acme");
    const row = rowFor(/^acme-issuing-r01/);
    fireEvent.click(within(row).getByRole("button", { name: /enable/i }));
    await waitFor(() =>
      expect(getNode("acme-issuing-r01")?.protocols).toContainEqual(
        expect.objectContaining({ configured: true, protocol: "acme" }),
      ),
    );
  });

  it("offers no switch for an ineligible node", () => {
    renderAt("/protocols/acme");
    const row = rowFor(/^acme-root-01/);
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides the switch for a non-admin", () => {
    operatorLevel = "viewer";
    renderAt("/protocols/acme");
    const row = rowFor(/^acme-issuing-01/);
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    expect(within(row).getByText(/admin only/i)).toBeInTheDocument();
  });

  it("shows the manager's refusal reason inline on a failed switch", async () => {
    vi.mocked(protocolsMod.switchNodeProtocol).mockRejectedValueOnce(
      new Error("fleet: node refused: context deadline"),
    );

    renderAt("/protocols/acme");
    const row = rowFor(/^acme-issuing-01/);
    fireEvent.click(within(row).getByRole("button", { name: /disable/i }));

    await waitFor(() => expect(within(row).getByRole("alert")).toHaveTextContent(/node refused/i));
  });
});
