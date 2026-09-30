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

import type { ColumnDef } from "@tanstack/react-table";

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { DataTable } from "./data-table";

type Row = { kind: string; name: string; size: number };

const data: Row[] = [
  { kind: "leaf", name: "alpha", size: 3 },
  { kind: "ca", name: "bravo", size: 1 },
  { kind: "leaf", name: "charlie", size: 2 },
];

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "kind", header: "Kind" },
  { accessorKey: "size", header: "Size" },
];

const renderTable = (over: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) =>
  render(
    <MemoryRouter>
      <DataTable
        columns={columns}
        data={data}
        facets={[{ columnId: "kind", title: "Kind" }]}
        pageSize={2}
        searchKeys={["name"]}
        {...over}
      />
    </MemoryRouter>,
  );

const bodyRowCount = () => screen.getByRole("table").querySelectorAll("tbody tr").length;

describe("DataTable", () => {
  it("renders rows limited to the first page", () => {
    renderTable();
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(bodyRowCount()).toBe(2); // pageSize 2
  });

  it("filters by a per-column text input", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Filter name"), { target: { value: "brav" } });
    expect(screen.getByText("bravo")).toBeInTheDocument();
    expect(screen.queryByText("alpha")).not.toBeInTheDocument();
  });

  it("narrows by a per-column select filter", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Filter Kind"), { target: { value: "ca" } });
    expect(screen.getByText("bravo")).toBeInTheDocument();
    expect(screen.queryByText("alpha")).not.toBeInTheDocument();
  });

  it("sorts when a header is clicked", () => {
    renderTable({ pageSize: 25 });
    fireEvent.click(screen.getByRole("button", { name: /size/i }));
    const rows = screen.getByRole("table").querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("bravo"); // size 1 first (ascending)
  });

  it("paginates and moves to the next page", () => {
    renderTable();
    expect(screen.queryByText("charlie")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("charlie")).toBeInTheDocument();
  });

  it("always shows the pagination footer", () => {
    renderTable({ pageSize: 25 });
    // one page of rows, but the footer (and a disabled Next) is always present
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Filter name"), { target: { value: "zzz" } });
    expect(screen.getByText(/no matching rows/i)).toBeInTheDocument();
  });

  it("lists every value in a select filter regardless of other active filters", () => {
    renderTable({ pageSize: 25 });
    // filter name to only bravo (kind "ca"); the Kind select must still offer "leaf"
    fireEvent.change(screen.getByLabelText("Filter name"), { target: { value: "bravo" } });
    const kindSelect = screen.getByLabelText("Filter Kind");
    const optionValues = [...kindSelect.querySelectorAll("option")].map((o) =>
      o.getAttribute("value"),
    );
    expect(optionValues).toContain("leaf");
    expect(optionValues).toContain("ca");
  });
});
