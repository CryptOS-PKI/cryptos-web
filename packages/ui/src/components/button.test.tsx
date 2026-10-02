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

import { Button } from "./button";

describe("Button", () => {
  it("runs onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Adopt node</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Adopt node" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Preview</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("keeps an explicit type", () => {
    render(<Button type="submit">Apply</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("shows the loading label, marks itself busy and ignores presses", () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Adopting…" onClick={onClick}>
        Adopt node
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Adopting…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps its own label while loading when no loading label is given", () => {
    render(<Button loading>Revoke</Button>);
    expect(screen.getByRole("button", { name: "Revoke" })).toHaveAttribute("aria-busy", "true");
  });

  it("is disabled with the native attribute", () => {
    render(<Button disabled>Preview</Button>);
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
  });

  it("stays focusable when locked by level and explains why", () => {
    const onClick = vi.fn();
    render(
      <Button lockedReason="Needs admin level; you are operator" onClick={onClick}>
        Apply
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Apply/ });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", "Needs admin level; you are operator");
    expect(button).toHaveAccessibleDescription("Needs admin level; you are operator");
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies each variant's classes", () => {
    const { rerender } = render(<Button variant="destructive">Revoke</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-destructive");
    rerender(<Button variant="ghost-danger">Revoke</Button>);
    expect(screen.getByRole("button")).toHaveClass("text-destructive");
    rerender(<Button variant="outline">Copy</Button>);
    expect(screen.getByRole("button")).toHaveClass("border");
    rerender(<Button variant="dev">Simulate</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-dashed");
  });

  it("renders its child element instead of a button with asChild", () => {
    render(
      <Button asChild>
        <a href="/adopt">Adopt</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Adopt" });
    expect(link).toHaveAttribute("href", "/adopt");
    expect(link).not.toHaveAttribute("type");
  });

  it("uses a 48 px target at size touch", () => {
    render(<Button size="touch">Approve</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-12");
  });
});
