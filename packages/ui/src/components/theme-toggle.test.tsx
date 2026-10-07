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

import { expectNoA11yViolations } from "../test/axe";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("has no axe violations", async () => {
    const { container } = render(<ThemeToggle onToggle={() => {}} theme="dark" />);
    await expectNoA11yViolations(container);
  });

  it("offers the other theme and toggles", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ThemeToggle onToggle={onToggle} theme="dark" />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<ThemeToggle onToggle={onToggle} theme="light" />);
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toHaveAttribute(
      "title",
      "Switch to dark theme",
    );
  });
});
