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

import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthState } from "@/context/auth";

import { AppShell } from "@/components/layout/app-shell";
import { APPROVALS_CHANGED } from "@/lib/approvals";
import { expectNoA11yViolations } from "@/test/axe";

const login = vi.fn();
let authState: AuthState;

vi.mock("@/context/auth", () => ({ useAuth: () => authState }));

const toggleTheme = vi.fn();
let theme: "dark" | "light" = "dark";
vi.mock("@/context/theme", () => ({ useTheme: () => ({ theme, toggleTheme }) }));

// The copy action has its own tests and needs a router and the optional auth
// hook; stubbing it keeps this test on the shell's own behaviour.
vi.mock("@/components/layout/diagnostics-copy", () => ({
  DiagnosticsCopy: () => null,
}));

const listApprovals = vi.fn();
vi.mock("@/lib/approvals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/approvals")>()),
  listApprovals: (...a: unknown[]) => listApprovals(...a),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route element={<p>page content</p>} index />
          <Route element={<p>page content</p>} path="*" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  login.mockReset();
  toggleTheme.mockReset();
  theme = "dark";
  authState = {
    login,
    operator: { commonName: "alice@acme.example", level: "operator", serial: "0A:BC" },
    reason: null,
    status: "authenticated",
  };
  listApprovals.mockReset();
  listApprovals.mockResolvedValue([]);
});

describe("AppShell", () => {
  it("has no axe violations", async () => {
    const { container } = renderAt("/");
    await expectNoA11yViolations(container);
  });

  it("renders the FleetOS brand linking home", () => {
    renderAt("/");
    const link = screen.getByRole("link", { name: /fleet\s*os/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders the routed page content", () => {
    renderAt("/");
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("shows the pre-1.0 banner", () => {
    renderAt("/");
    expect(screen.getByText("PRE-1.0")).toBeInTheDocument();
    expect(screen.getByText(/any release may change fundamentally/i)).toBeInTheDocument();
  });

  it("shows the operator identity and level in the top bar", () => {
    renderAt("/");
    expect(screen.getByText("alice@acme.example")).toBeInTheDocument();
    expect(screen.getByText("operator")).toBeInTheDocument();
  });

  it("toggles the theme", () => {
    renderAt("/");
    screen.getByRole("button", { name: /switch to light theme/i }).click();
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("groups the nav under FLEET, CERTIFICATES, ACCESS and ACTIVITY", () => {
    renderAt("/");
    expect(screen.getByText("FLEET")).toBeInTheDocument();
    expect(screen.getByText("CERTIFICATES")).toBeInTheDocument();
    expect(screen.getByText("ACCESS")).toBeInTheDocument();
    expect(screen.getByText("ACTIVITY")).toBeInTheDocument();
  });

  it("marks the current route current", () => {
    renderAt("/fleet");
    expect(screen.getByRole("link", { name: /^fleet$/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /dashboard/i })).not.toHaveAttribute("aria-current");
  });

  // Root before Nodes: that is the order the hierarchy reads, and /nodes
  // excludes roots, so meeting Nodes first and finding the root missing is
  // what made this confusing (#86).
  it("orders Root before Nodes", () => {
    renderAt("/");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.indexOf("/root")).toBeGreaterThan(-1);
    expect(hrefs.indexOf("/root")).toBeLessThan(hrefs.indexOf("/nodes"));
    expect(hrefs.indexOf("/fleet")).toBeLessThan(hrefs.indexOf("/root"));
  });

  it("renders the primary nav links", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /^fleet$/i })).toHaveAttribute("href", "/fleet");
    expect(screen.getByRole("link", { name: /nodes/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /certificates/i })).toHaveAttribute(
      "href",
      "/certificates",
    );
    expect(screen.getByRole("link", { name: /enrollment/i })).toHaveAttribute(
      "href",
      "/enrollment",
    );
    expect(screen.getByRole("link", { name: /profiles/i })).toHaveAttribute("href", "/profiles");
    expect(screen.getByRole("link", { name: /protocols/i })).toHaveAttribute("href", "/protocols");
    expect(screen.getByRole("link", { name: /root/i })).toHaveAttribute("href", "/root");
    expect(screen.getByRole("link", { name: /operators/i })).toHaveAttribute("href", "/operators");
    expect(screen.getByRole("link", { name: /audit/i })).toBeInTheDocument();
  });

  it("places Agent keys right after Operators", () => {
    renderAt("/");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.indexOf("/agent-keys")).toBe(hrefs.indexOf("/operators") + 1);
  });

  it("places Operator CAs right before Operators", () => {
    renderAt("/");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.indexOf("/operator-cas")).toBe(hrefs.indexOf("/operators") - 1);
  });

  it("places Approvals right after Agent keys", () => {
    renderAt("/");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.indexOf("/approvals")).toBe(hrefs.indexOf("/agent-keys") + 1);
  });

  it("badges Approvals with the pending count", async () => {
    listApprovals.mockResolvedValue([{ id: "ap-1" }, { id: "ap-2" }]);
    renderAt("/");

    expect(await screen.findByLabelText("2 pending approvals")).toHaveTextContent("2");
    expect(listApprovals).toHaveBeenCalledWith({ status: "pending" });
  });

  it("shows no badge when nothing is pending or the count cannot be read", async () => {
    listApprovals.mockRejectedValue(new Error("manager unreachable"));
    renderAt("/");
    await act(async () => {});

    expect(screen.queryByLabelText(/pending approvals/)).not.toBeInTheDocument();
  });

  it("recounts after a decision", async () => {
    listApprovals.mockResolvedValue([{ id: "ap-1" }, { id: "ap-2" }]);
    renderAt("/");
    await screen.findByLabelText("2 pending approvals");

    listApprovals.mockResolvedValue([{ id: "ap-2" }]);
    act(() => {
      globalThis.dispatchEvent(new Event(APPROVALS_CHANGED));
    });

    expect(await screen.findByLabelText("1 pending approval")).toHaveTextContent("1");
  });

  it("locks Adopt for an operator who is not admin", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: /adopt/i })).toHaveAttribute(
      "title",
      "Needs admin level",
    );
  });

  it("does not lock Adopt for an admin", () => {
    authState = {
      login,
      operator: { commonName: "alice@acme.example", level: "admin", serial: "0A:BC" },
      reason: null,
      status: "authenticated",
    };
    renderAt("/");
    expect(screen.getByRole("link", { name: /adopt/i })).not.toHaveAttribute("title");
  });
});
