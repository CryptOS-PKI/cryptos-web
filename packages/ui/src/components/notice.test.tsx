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

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Notice } from "./notice";

describe("Notice", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <Notice title="Needs reboot" tone="warning">
        This change takes effect only after the node reboots.
      </Notice>,
    );
    await expectNoA11yViolations(container);
  });

  it("renders a title and body with the tone's edge", () => {
    render(
      <Notice title="Needs reboot" tone="warning">
        This change takes effect only after the node reboots.
      </Notice>,
    );
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Needs reboot");
    expect(note).toHaveTextContent("This change takes effect only after the node reboots.");
    expect(note).toHaveClass("border-l-warning");
  });

  // #201: a saturated tone color as the title's text, over that same tone's
  // 10% tint, fell as low as 2.8:1 in the light theme -- short of the 4.5:1
  // normal-text minimum. The tone now shows only on the left edge and the
  // icon; the title and body always read in the foreground color, which is
  // already the app's body-text pairing against the card background.
  it("keeps title and body text in the foreground color, not the tone, so every tone passes contrast", () => {
    render(
      <Notice title="Needs reboot" tone="warning">
        This change takes effect only after the node reboots.
      </Notice>,
    );
    const note = screen.getByRole("note");
    expect(note.querySelector("p")).toHaveClass("text-foreground");
    expect(note.querySelector("p")).not.toHaveClass("text-warning");
    expect(note).toHaveClass("bg-card");
    expect(note).not.toHaveClass("bg-warning/10");
  });

  it("is full width of its container", () => {
    render(<Notice>Body</Notice>);
    expect(screen.getByRole("note")).toHaveClass("w-full");
  });

  it("is an alert for the danger tone so it is announced", () => {
    render(<Notice tone="danger">There is no undo.</Notice>);
    expect(screen.getByRole("alert")).toHaveTextContent("There is no undo.");
  });

  it("is a status for the success tone", () => {
    render(<Notice tone="success">Config applied.</Notice>);
    expect(screen.getByRole("status")).toHaveTextContent("Config applied.");
  });

  it("lets the caller pick the role", () => {
    render(
      <Notice role="note" tone="danger">
        Save the key backup.
      </Notice>,
    );
    expect(screen.getByRole("note")).toHaveTextContent("Save the key backup.");
  });

  it("defaults to the info tone", () => {
    render(<Notice>ACME and EST are served by the nodes themselves.</Notice>);
    expect(screen.getByRole("note")).toHaveAttribute("data-tone", "info");
  });

  it("renders an action", () => {
    render(
      <Notice action={<a href="/x">Fix it</a>} tone="info">
        Body
      </Notice>,
    );
    expect(screen.getByRole("link", { name: "Fix it" })).toBeInTheDocument();
  });
});
