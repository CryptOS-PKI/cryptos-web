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

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrustChain, TrustChainChip } from "./trust-chain";

describe("TrustChain", () => {
  const items = [
    { id: "root", label: "Example Root CA G1", role: "root" as const },
    { id: "n1", label: "node-01", status: "established" as const },
    { id: "n2", label: "node-02", status: "pending" as const },
  ];

  it("lists each link in order and marks the last one current", () => {
    render(<TrustChain items={items} label="Trust chain" />);
    const list = screen.getByRole("list", { name: "Trust chain" });
    const links = list.querySelectorAll("li");
    expect([...links].map((l) => l.textContent)).toEqual([
      "Example Root CA G1",
      "node-01",
      "node-02",
    ]);
    expect(screen.getByText("node-02").closest("[data-current]")).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("stacks downward when vertical", () => {
    render(<TrustChain items={items} label="Trust chain" orientation="vertical" />);
    expect(screen.getByRole("list", { name: "Trust chain" })).toHaveAttribute(
      "data-orientation",
      "vertical",
    );
  });

  it("makes a chip a button when it has onClick", () => {
    const onClick = vi.fn();
    render(<TrustChainChip label="node-01" onClick={onClick} status="established" />);
    fireEvent.click(screen.getByRole("button", { name: "node-01" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("gives a chip the state tone", () => {
    render(<TrustChainChip label="node-06" status="revoked" />);
    expect(screen.getByText("node-06").closest("[data-status]")).toHaveClass(
      "border-destructive/40",
    );
  });
});
