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

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "../components/tooltip";
import { expectNoA11yViolations } from "../test/axe";
import { type Role, RoleGate, roleRank } from "./role-gate";

const gated = (have: Role, onClick: () => void) =>
  render(
    <TooltipProvider delayDuration={0}>
      <RoleGate have={have} need="admin">
        <button onClick={onClick} type="button">
          Rotate key
        </button>
      </RoleGate>
    </TooltipProvider>,
  );

describe("roleRank", () => {
  it("ranks admin above operator above viewer", () => {
    expect(roleRank.admin).toBeGreaterThan(roleRank.operator);
    expect(roleRank.operator).toBeGreaterThan(roleRank.viewer);
  });
});

describe("RoleGate", () => {
  it("passes the child through untouched when the role is enough", () => {
    const onClick = vi.fn();
    gated("admin", onClick);
    fireEvent.click(screen.getByRole("button", { name: "Rotate key" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("blocks keyboard activation, stays focusable and explains why", async () => {
    const onClick = vi.fn();
    gated("operator", onClick);
    const btn = screen.getByRole("button", { name: /Rotate key/ });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(btn.tabIndex).not.toBe(-1);

    // Tooltip's open state updates on focus, so the native .focus() call
    // (needed to make document.activeElement move, unlike fireEvent.focus)
    // has to settle inside act() before the tooltip assertion below.
    act(() => {
      btn.focus();
    });
    expect(btn).toHaveFocus();

    // A cancelable event's fireEvent return value is false once
    // preventDefault() runs inside a listener, so this pins that Enter and
    // Space are both intercepted rather than left to the button's native
    // keydown-to-click activation.
    expect(fireEvent.keyDown(btn, { key: "Enter" })).toBe(false);
    expect(fireEvent.keyDown(btn, { key: " " })).toBe(false);
    expect(fireEvent.click(btn)).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
    expect(btn).toHaveFocus();

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Needs the admin role");
  });

  it("has no axe violations", async () => {
    const { container } = gated("viewer", vi.fn());
    await expectNoA11yViolations(container);
  });
});
