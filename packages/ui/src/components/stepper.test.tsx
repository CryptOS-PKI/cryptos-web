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
import { Stepper } from "./stepper";

const steps = [
  { id: "token", label: "Token" },
  { id: "ca", label: "Operator CA" },
  { id: "admin", label: "First admin" },
  { id: "install", label: "Install" },
];

describe("Stepper", () => {
  it("has no axe violations", async () => {
    const { container } = render(<Stepper current={2} steps={steps} />);
    await expectNoA11yViolations(container);
  });

  it("marks the current step", () => {
    render(<Stepper current={2} steps={steps} />);
    expect(screen.getByRole("list", { name: "Progress" })).toBeInTheDocument();
    const current = screen.getByText("First admin").closest("li");
    expect(current).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Token").closest("li")).toHaveAttribute("data-state", "done");
    expect(screen.getByText("Install").closest("li")).toHaveAttribute("data-state", "upcoming");
  });

  it("lets done steps be revisited when the caller allows it", () => {
    const onStepClick = vi.fn();
    render(<Stepper current={2} onStepClick={onStepClick} steps={steps} />);
    fireEvent.click(screen.getByRole("button", { name: /Operator CA/ }));
    expect(onStepClick).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("button", { name: /Install/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /First admin/ })).not.toBeInTheDocument();
  });

  it("keeps a done step static when going back is not safe", () => {
    render(
      <Stepper canRevisit={(i) => i !== 0} current={2} onStepClick={() => {}} steps={steps} />,
    );
    expect(screen.queryByRole("button", { name: /Token/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Operator CA/ })).toBeInTheDocument();
  });

  it("uses a custom accessible name", () => {
    render(<Stepper current={0} label="Re-key steps" steps={steps} />);
    expect(screen.getByRole("list", { name: "Re-key steps" })).toBeInTheDocument();
  });
});
