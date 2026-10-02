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
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { Input } from "./input";

describe("Input", () => {
  it("forwards typed values", () => {
    const onChange = vi.fn();
    render(<Input aria-label="Endpoint" onChange={onChange} value="" />);
    fireEvent.change(screen.getByLabelText("Endpoint"), { target: { value: "192.0.2.10:443" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("marks itself invalid", () => {
    render(<Input aria-label="Token" invalid />);
    const input = screen.getByLabelText("Token");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("border-destructive");
  });

  it("is not marked invalid by default", () => {
    render(<Input aria-label="Token" />);
    expect(screen.getByLabelText("Token")).not.toHaveAttribute("aria-invalid");
  });

  it("forwards its ref", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input aria-label="Name" ref={ref} />);
    expect(ref.current).toBe(screen.getByLabelText("Name"));
  });

  it("uses sans text when mono is off", () => {
    render(<Input aria-label="Name" mono={false} />);
    expect(screen.getByLabelText("Name")).toHaveClass("font-sans");
  });
});
