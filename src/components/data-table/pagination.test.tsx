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

import { Pagination } from "./pagination";

const makeTable = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    getCanNextPage: () => true,
    getCanPreviousPage: () => false,
    getFilteredRowModel: () => ({ rows: Array.from({ length: 50 }) }),
    getPageCount: () => 2,
    getState: () => ({ pagination: { pageIndex: 0, pageSize: 25 } }),
    nextPage: vi.fn(),
    previousPage: vi.fn(),
    setPageSize: vi.fn(),
    ...over,
  }) as never;

describe("Pagination", () => {
  it("renders the current range and total", () => {
    render(<Pagination table={makeTable()} />);
    expect(screen.getByText(/1\u201325 of 50/)).toBeInTheDocument();
  });

  it("renders the current page of the total page count", () => {
    render(<Pagination table={makeTable()} />);
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
  });

  it("disables Prev at the first page", () => {
    render(<Pagination table={makeTable()} />);
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
  });

  it("calls nextPage on Next", () => {
    const next = vi.fn();
    render(<Pagination table={makeTable({ nextPage: next })} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(next).toHaveBeenCalled();
  });

  it("changes the page size via the rows-per-page select", () => {
    const setPageSize = vi.fn();
    render(<Pagination table={makeTable({ setPageSize })} />);
    fireEvent.change(screen.getByLabelText(/rows per page/i), { target: { value: "20" } });
    expect(setPageSize).toHaveBeenCalledWith(20);
  });
});
