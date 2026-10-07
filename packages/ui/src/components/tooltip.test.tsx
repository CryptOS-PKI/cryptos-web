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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Tooltip, TooltipProvider } from "./tooltip";

describe("Tooltip", () => {
  it("shows its content on keyboard focus and links it by aria-describedby", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip content="Needs the admin role">
          <button type="button">Rotate</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Rotate" });
    fireEvent.focus(trigger);
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Needs the admin role");
    expect(trigger).toHaveAttribute("aria-describedby");
  });

  it("hides its content on blur", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip content="Needs the admin role">
          <button type="button">Rotate</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Rotate" });
    fireEvent.focus(trigger);
    await screen.findByRole("tooltip");
    fireEvent.blur(trigger);
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <TooltipProvider>
        <Tooltip content="x">
          <button type="button">y</button>
        </Tooltip>
      </TooltipProvider>,
    );
    await expectNoA11yViolations(container);
  });
});
