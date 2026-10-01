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
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TopNav } from "@/components/layout/top-nav";
import { APPROVALS_CHANGED } from "@/lib/approvals";

const listApprovals = vi.fn();
vi.mock("@/lib/approvals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/approvals")>()),
  listApprovals: (...a: unknown[]) => listApprovals(...a),
}));

beforeEach(() => {
  listApprovals.mockReset();
  listApprovals.mockResolvedValue([]);
});

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

  it("places Operator CAs right before Operators", () => {
    render(
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>,
    );
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.indexOf("/operator-cas")).toBe(hrefs.indexOf("/operators") - 1);
  });

  it("places Approvals right after Agent keys", () => {
    render(
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>,
    );
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.indexOf("/approvals")).toBe(hrefs.indexOf("/agent-keys") + 1);
  });

  it("badges Approvals with the pending count", async () => {
    listApprovals.mockResolvedValue([{ id: "ap-1" }, { id: "ap-2" }]);
    render(
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText("2 pending approvals")).toHaveTextContent("2");
    expect(listApprovals).toHaveBeenCalledWith({ status: "pending" });
  });

  it("shows no badge when nothing is pending or the count cannot be read", async () => {
    listApprovals.mockRejectedValue(new Error("manager unreachable"));
    render(
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>,
    );
    await act(async () => {});

    expect(screen.queryByLabelText(/pending approvals/)).not.toBeInTheDocument();
  });

  it("recounts after a decision", async () => {
    listApprovals.mockResolvedValue([{ id: "ap-1" }, { id: "ap-2" }]);
    render(
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>,
    );
    await screen.findByLabelText("2 pending approvals");

    listApprovals.mockResolvedValue([{ id: "ap-2" }]);
    act(() => {
      globalThis.dispatchEvent(new Event(APPROVALS_CHANGED));
    });

    expect(await screen.findByLabelText("1 pending approval")).toHaveTextContent("1");
  });
});
