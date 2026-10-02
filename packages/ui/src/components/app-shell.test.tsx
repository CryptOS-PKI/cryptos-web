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

import { fireEvent, render, screen, within } from "@testing-library/react";
import { LayoutGrid, Network } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell, NavItem, NavSection, PageHeader } from "./app-shell";

const setDesktop = (desktop: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener: () => {},
    matches: desktop,
    media: query,
    removeEventListener: () => {},
  }));

afterEach(() => vi.unstubAllGlobals());

const nav = (
  <>
    <NavSection>
      <NavItem active asChild icon={LayoutGrid} label="Dashboard">
        <a href="/">x</a>
      </NavItem>
    </NavSection>
    <NavSection label="Fleet">
      <NavItem asChild badge={3} badgeLabel="3 pending approvals" icon={Network} label="Fleet">
        <a href="/fleet">x</a>
      </NavItem>
    </NavSection>
  </>
);

describe("AppShell", () => {
  it("shows the sidebar, top bar, banner and content on a desktop", () => {
    setDesktop(true);
    render(
      <AppShell
        banner={<span>PRE-1.0</span>}
        brand={<span>FleetOS</span>}
        nav={nav}
        navFooter="FleetOS v0.1.0"
        topBar={<span>alice@example.org</span>}
      >
        <p>page</p>
      </AppShell>,
    );
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(main).getByRole("link", { name: /Fleet/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Fleet", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByLabelText("3 pending approvals")).toHaveTextContent("3");
    expect(screen.getByText("PRE-1.0")).toBeInTheDocument();
    expect(screen.getByText("alice@example.org")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("page");
    expect(screen.getByText("FleetOS v0.1.0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open navigation" })).not.toBeInTheDocument();
  });

  it("puts the navigation in a drawer on a phone", () => {
    setDesktop(false);
    render(
      <AppShell brand={<span>FleetOS</span>} nav={nav}>
        <p>page</p>
      </AppShell>,
    );
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    const open = screen.getByRole("button", { name: "Open navigation" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    open.focus();
    fireEvent.click(open);
    const drawer = screen.getByRole("dialog", { name: "Navigation" });
    expect(within(drawer).getByRole("link", { name: "Dashboard" })).toHaveFocus();
    fireEvent.keyDown(drawer, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(open).toHaveFocus();
  });

  it("closes the drawer when a link is chosen", () => {
    setDesktop(false);
    render(
      <AppShell brand={<span>FleetOS</span>} nav={nav}>
        page
      </AppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const link = within(screen.getByRole("dialog")).getByRole("link", { name: /Fleet/ });
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the drawer from its close button", () => {
    setDesktop(false);
    render(
      <AppShell brand={<span>FleetOS</span>} nav={nav}>
        page
      </AppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("NavItem", () => {
  it("shows a lock for items above the caller's level", () => {
    render(
      <NavItem asChild icon={Network} label="Adopt" locked="Needs admin level">
        <a href="/adopt">x</a>
      </NavItem>,
    );
    expect(screen.getByRole("link", { name: /Adopt/ })).toHaveAttribute(
      "title",
      "Needs admin level",
    );
  });
});

describe("PageHeader", () => {
  it("renders the back link, title, description and actions", () => {
    render(
      <PageHeader
        actions={<button type="button">Issue…</button>}
        back={<a href="/nodes">Nodes</a>}
        description="Issuing CA"
        title="node-02"
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "node-02" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nodes" })).toBeInTheDocument();
    expect(screen.getByText("Issuing CA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Issue…" })).toBeInTheDocument();
  });
});
