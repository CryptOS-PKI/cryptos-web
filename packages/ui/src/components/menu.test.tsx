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
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./menu";

const Harness = () => (
  <Menu>
    <MenuTrigger asChild>
      <button type="button">Actions</button>
    </MenuTrigger>
    <MenuContent>
      <MenuItem>Rotate</MenuItem>
      <MenuItem>Revoke</MenuItem>
    </MenuContent>
  </Menu>
);

describe("Menu", () => {
  it("opens on Enter and moves between items with arrow keys", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const rotate = await screen.findByRole("menuitem", { name: "Rotate" });
    await waitFor(() => expect(rotate).toHaveFocus());
    fireEvent.keyDown(rotate, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Revoke" })).toHaveFocus());
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("has no axe violations", async () => {
    const { container } = render(<Harness />);
    await expectNoA11yViolations(container);
  });
});
