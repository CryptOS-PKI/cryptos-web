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
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileForm } from "@/components/profile-form";
import { __resetProfiles, getProfile } from "@/lib/profiles";
import { expectNoA11yViolations } from "@/test/axe";

let operatorLevel: "admin" | "operator" | "viewer" = "admin";
vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    operator: { commonName: "admin@acme.example", level: operatorLevel, serial: "AA" },
    status: "authenticated",
  }),
}));

describe("ProfileForm", () => {
  beforeEach(() => {
    operatorLevel = "admin";
    __resetProfiles();
  });

  it("has no axe violations for a non-admin", async () => {
    operatorLevel = "viewer";
    const { container } = render(<ProfileForm mode="create" onDone={vi.fn()} />);
    await expectNoA11yViolations(container);
  });

  it("saves a new profile for an admin", async () => {
    const onDone = vi.fn();
    render(<ProfileForm mode="create" onDone={onDone} />);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "New Profile" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith("New Profile"));
    expect(getProfile("New Profile")).toBeDefined();
  });

  // Was a "Read-only — editing profiles requires admin level" note instead of
  // the button; #196 moves it to the kit's lock pattern so a viewer still
  // sees Save and why it's unavailable.
  it("locks Save for a non-admin instead of hiding it", () => {
    operatorLevel = "viewer";
    const onDone = vi.fn();
    render(<ProfileForm mode="create" onDone={onDone} />);
    const button = screen.getByRole("button", { name: /^save/i });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(/needs the admin role/i);
    fireEvent.click(button);
    expect(onDone).not.toHaveBeenCalled();
  });

  // #200: the form's top-level sections are full-width tabs, so only one
  // section's fields are reachable at a time.
  it("shows the common settings fields by default and keeps the others out of the tree", () => {
    render(<ProfileForm mode="create" onDone={vi.fn()} />);
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^dns sans$/i)).not.toBeInTheDocument();
  });

  it("switches to the Key usage tab on click", () => {
    render(<ProfileForm mode="create" onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Key usage" }));
    expect(screen.getByRole("button", { name: "digital_signature" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", async () => {
    render(<ProfileForm mode="create" onDone={vi.fn()} />);
    const common = screen.getByRole("tab", { name: "Common settings" });
    await act(async () => {
      common.focus();
    });
    await act(async () => {
      fireEvent.keyDown(common, { key: "ArrowRight" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const keyUsage = screen.getByRole("tab", { name: "Key usage" });
    expect(keyUsage).toHaveFocus();
    expect(keyUsage).toHaveAttribute("aria-selected", "true");
  });
});
