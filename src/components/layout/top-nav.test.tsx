/*
Apache License 2.0

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

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { TopNav } from "@/components/layout/top-nav";

describe("TopNav", () => {
  // Root before Nodes: that is the order the hierarchy reads, and /nodes
  // excludes roots, so meeting Nodes first and finding the root missing is
  // what made this confusing (#86).
  it("orders Root before Nodes", () => {
    render(
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>,
    );
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.indexOf("/root")).toBeGreaterThan(-1);
    expect(hrefs.indexOf("/root")).toBeLessThan(hrefs.indexOf("/nodes"));
    expect(hrefs.indexOf("/fleet")).toBeLessThan(hrefs.indexOf("/root"));
  });

  it("renders the primary nav links", () => {
    render(
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>,
    );
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
    render(
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>,
    );
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.indexOf("/agent-keys")).toBe(hrefs.indexOf("/operators") + 1);
  });
});
