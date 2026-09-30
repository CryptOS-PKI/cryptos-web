/*
Apache License 2.0

Copyright 2026 Shane

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

import { ColumnHeader } from "./column-header";

const makeColumn = (sorted: "asc" | "desc" | false, handler: () => void) =>
  ({
    getIsSorted: () => sorted,
    getToggleSortingHandler: () => handler,
  }) as never;

describe("ColumnHeader", () => {
  it("invokes the toggle-sorting handler on click", () => {
    const handler = vi.fn();
    render(<ColumnHeader column={makeColumn(false, handler)} title="Name" />);
    fireEvent.click(screen.getByRole("button", { name: /name/i }));
    expect(handler).toHaveBeenCalled();
  });

  it("renders a sort-direction icon in the header button", () => {
    const { container } = render(<ColumnHeader column={makeColumn("asc", vi.fn())} title="Name" />);
    // lucide icons render as inline svg; a sorted column shows a full-opacity arrow
    const icon = container.querySelector("button svg");
    expect(icon).not.toBeNull();
  });
});
