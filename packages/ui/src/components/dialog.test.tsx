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
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Dialog } from "./dialog";

// Radix's DismissableLayer registers its own outside-pointerdown listener a
// tick after mount (so the click that opened the dialog isn't mistaken for an
// outside click); this lets that registration, and the pointerdown itself,
// settle before the next event fires.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

const Harness = ({ variant }: { variant?: "destructive" | "standard" | "wide" }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Open
      </button>
      <Dialog
        footer={
          <>
            <button onClick={() => setOpen(false)} type="button">
              Cancel
            </button>
            <button type="button">Revoke</button>
          </>
        }
        onClose={() => setOpen(false)}
        open={open}
        title="Revoke certificate"
        variant={variant}
      >
        <input aria-label="Reason" />
      </Dialog>
    </>
  );
};

describe("Dialog", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <Dialog description="web-01.example.org" onClose={() => {}} open title="Revoke certificate">
        body
      </Dialog>,
    );
    await expectNoA11yViolations(container);
  });

  it("renders nothing while closed", () => {
    render(<Dialog onClose={() => {}} open={false} title="T" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a labelled, described modal", () => {
    render(
      <Dialog description="web-01.example.org" onClose={() => {}} open title="Revoke certificate">
        body
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Revoke certificate" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("web-01.example.org");
  });

  it("moves focus to the first field and returns it to the trigger on close", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByLabelText("Reason")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(trigger).toHaveFocus();
  });

  it("keeps Tab inside the dialog", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const revoke = screen.getByRole("button", { name: "Revoke" });
    revoke.focus();
    fireEvent.keyDown(revoke, { key: "Tab" });
    expect(screen.getByLabelText("Reason")).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText("Reason"), { key: "Tab", shiftKey: true });
    expect(revoke).toHaveFocus();
  });

  it("closes on Escape", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hands Escape to onEscape instead when given", () => {
    const onClose = vi.fn();
    const onEscape = vi.fn();
    render(<Dialog onClose={onClose} onEscape={onEscape} open title="Agent key" />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a backdrop click only when it allows it", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Dialog closeOnBackdrop onClose={onClose} open title="T" />);
    fireEvent.click(screen.getByTestId("dialog-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
    rerender(<Dialog onClose={onClose} open title="T" variant="destructive" />);
    fireEvent.click(screen.getByTestId("dialog-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close when the panel itself is clicked", () => {
    const onClose = vi.fn();
    render(<Dialog closeOnBackdrop onClose={onClose} open title="T" />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the danger disc on destructive dialogs", () => {
    render(<Dialog onClose={() => {}} open title="Decommission node-02" variant="destructive" />);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-variant", "destructive");
    expect(screen.getByTestId("dialog-danger-icon")).toBeInTheDocument();
  });

  it("uses the wide panel", () => {
    render(<Dialog onClose={() => {}} open title="Wide" variant="wide" />);
    expect(screen.getByRole("dialog")).toHaveClass("sm:max-w-[720px]");
  });

  it("calls onEscape instead of closing when given", () => {
    const onClose = vi.fn();
    const onEscape = vi.fn();
    render(
      <Dialog onClose={onClose} onEscape={onEscape} open title="Ask">
        <input />
      </Dialog>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("never closes a destructive dialog on backdrop click", async () => {
    const onClose = vi.fn();
    render(<Dialog closeOnBackdrop onClose={onClose} open title="Delete" variant="destructive" />);
    const backdrop = screen.getByTestId("dialog-backdrop");
    await settle();
    fireEvent.pointerDown(backdrop);
    await settle();
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes a standard closeOnBackdrop dialog on backdrop click exactly once", async () => {
    const onClose = vi.fn();
    render(<Dialog closeOnBackdrop onClose={onClose} open title="T" />);
    const backdrop = screen.getByTestId("dialog-backdrop");
    await settle();
    fireEvent.pointerDown(backdrop);
    await settle();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("returns focus to the trigger on close", () => {
    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Open
          </button>
          <Dialog onClose={() => setOpen(false)} open={open} title="T">
            <input />
          </Dialog>
        </>
      );
    };
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(trigger).toHaveFocus();
  });
});
