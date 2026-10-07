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
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

// .focus() itself updates the roving focus group's current-tab-stop state
// (its onFocus handler), and the roving focus group moves focus one macrotask
// after the key event (setTimeout(() => focusFirst(...))); both have to run
// inside act to settle before the assertion.
const focus = async (target: HTMLElement) => {
  await act(async () => {
    target.focus();
  });
};

const pressKey = async (target: HTMLElement, key: string) => {
  await act(async () => {
    fireEvent.keyDown(target, { key });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const Harness = () => (
  <Tabs defaultValue="a">
    <TabsList aria-label="Sections">
      <TabsTrigger value="a">Alpha</TabsTrigger>
      <TabsTrigger value="b">Beta</TabsTrigger>
      <TabsTrigger value="c">Gamma</TabsTrigger>
    </TabsList>
    <TabsContent value="a">Alpha panel</TabsContent>
    <TabsContent value="b">Beta panel</TabsContent>
    <TabsContent value="c">Gamma panel</TabsContent>
  </Tabs>
);

describe("Tabs", () => {
  it("moves between tabs with arrow keys", async () => {
    render(<Harness />);
    const alpha = screen.getByRole("tab", { name: "Alpha" });
    await focus(alpha);
    await pressKey(alpha, "ArrowRight");
    const beta = screen.getByRole("tab", { name: "Beta" });
    expect(beta).toHaveFocus();
    expect(beta).toHaveAttribute("aria-selected", "true");
  });

  it("jumps to the first and last tab with Home and End", async () => {
    render(<Harness />);
    const beta = screen.getByRole("tab", { name: "Beta" });
    await focus(beta);
    await pressKey(beta, "End");
    const gamma = screen.getByRole("tab", { name: "Gamma" });
    expect(gamma).toHaveFocus();
    await pressKey(gamma, "Home");
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveFocus();
  });

  it("shows only the active panel", () => {
    render(<Harness />);
    expect(screen.getByText("Alpha panel")).toBeVisible();
    expect(screen.queryByText("Beta panel")).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<Harness />);
    await expectNoA11yViolations(container);
  });
});
