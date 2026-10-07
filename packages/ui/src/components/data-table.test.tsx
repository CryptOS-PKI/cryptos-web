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

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { DataTable, type DataTableColumn, DataTablePagination } from "./data-table";

type Cert = { cn: string; days: number; serial: string };

const rows: Cert[] = [
  { cn: "api.example.org", days: -3, serial: "4A:07" },
  { cn: "web-01.example.org", days: 12, serial: "5C:1E" },
];

const columns: DataTableColumn<Cert>[] = [
  { cell: (r) => r.cn, header: "Subject CN", id: "cn", mobile: "title" },
  { cell: (r) => r.serial, header: "Serial", id: "serial" },
  { cell: (r) => `${r.days}d`, header: "Days left", id: "days" },
];

const setDesktop = (desktop: boolean) => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener: () => {},
    matches: desktop,
    media: query,
    removeEventListener: () => {},
  }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DataTable", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <DataTable columns={columns} label="Certificates" rowKey={(r) => r.serial} rows={rows} />,
    );
    await expectNoA11yViolations(container);
  });

  it("renders a header and one row per item", () => {
    render(
      <DataTable columns={columns} label="Certificates" rowKey={(r) => r.serial} rows={rows} />,
    );
    const table = screen.getByRole("table", { name: "Certificates" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Subject CN", "Serial", "Days left"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("web-01.example.org")).toBeInTheDocument();
  });

  it("opens a row on click and on Enter", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        label="Certificates"
        onRowClick={onRowClick}
        rowKey={(r) => r.serial}
        rows={rows}
      />,
    );
    const row = screen.getByText("api.example.org").closest("tr") as HTMLElement;
    fireEvent.click(row);
    expect(onRowClick).toHaveBeenLastCalledWith(rows[0]);
    row.focus();
    expect(row).toHaveFocus();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it("does not make rows focusable without onRowClick", () => {
    render(
      <DataTable columns={columns} label="Certificates" rowKey={(r) => r.serial} rows={rows} />,
    );
    const row = screen.getByText("api.example.org").closest("tr") as HTMLElement;
    expect(row).not.toHaveAttribute("tabindex");
  });

  it("highlights the deep-linked row and scrolls it into view", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(
      <DataTable
        columns={columns}
        highlightKey="5C:1E"
        label="Certificates"
        rowKey={(r) => r.serial}
        rows={rows}
      />,
    );
    const row = screen.getByText("web-01.example.org").closest("tr") as HTMLElement;
    expect(row).toHaveAttribute("data-highlighted", "true");
    expect(row).toHaveAttribute("aria-current", "true");
    expect(scroll).toHaveBeenCalled();
  });

  it("marks sortable headers and reports a sort request", () => {
    const onSort = vi.fn();
    const sorted: DataTableColumn<Cert>[] = [
      { ...columns[0] },
      { ...columns[2], onSort, sort: "asc" },
    ];
    render(
      <DataTable columns={sorted} label="Certificates" rowKey={(r) => r.serial} rows={rows} />,
    );
    const header = screen.getByRole("columnheader", { name: /Days left/ });
    expect(header).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(within(header).getByRole("button"));
    expect(onSort).toHaveBeenCalledOnce();
  });

  it("renders a distinct shape for ascending, descending and unsorted", () => {
    const sorted: DataTableColumn<Cert>[] = [
      { ...columns[0], onSort: () => {}, sort: "asc" },
      { ...columns[1], onSort: () => {}, sort: "desc" },
      { ...columns[2], onSort: () => {}, sort: false },
    ];
    render(
      <DataTable columns={sorted} label="Certificates" rowKey={(r) => r.serial} rows={rows} />,
    );
    const asc = within(screen.getByRole("columnheader", { name: /Subject CN/ }));
    const desc = within(screen.getByRole("columnheader", { name: /Serial/ }));
    const unsorted = within(screen.getByRole("columnheader", { name: /Days left/ }));

    const ascIcons = asc.getAllByRole("button")[0].querySelectorAll("svg");
    const descIcons = desc.getAllByRole("button")[0].querySelectorAll("svg");
    expect(ascIcons).toHaveLength(1);
    expect(descIcons).toHaveLength(1);
    expect(ascIcons[0]).toHaveClass("rotate-180");
    expect(descIcons[0]).not.toHaveClass("rotate-180");

    const unsortedWrapper = unsorted.getByTestId("sort-icon-unsorted");
    expect(unsortedWrapper.querySelectorAll("svg")).toHaveLength(2);
  });

  it("renders a filter row when a column has a filter", () => {
    const withFilter: DataTableColumn<Cert>[] = [
      { ...columns[0], filter: <input aria-label="Filter CN" /> },
      columns[1],
    ];
    render(
      <DataTable columns={withFilter} label="Certificates" rowKey={(r) => r.serial} rows={rows} />,
    );
    expect(screen.getByLabelText("Filter CN")).toBeInTheDocument();
  });

  it("shows five skeleton rows while loading and marks the table busy", () => {
    render(
      <DataTable
        columns={columns}
        label="Certificates"
        rowKey={(r) => r.serial}
        rows={[]}
        status="loading"
      />,
    );
    const table = screen.getByRole("table", { name: "Certificates" });
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(table.querySelectorAll("[data-skeleton]")).toHaveLength(5);
  });

  it("shows the empty content when there are no rows", () => {
    render(
      <DataTable
        columns={columns}
        empty={<p>No certificates yet</p>}
        label="Certificates"
        rowKey={(r) => r.serial}
        rows={[]}
      />,
    );
    expect(screen.getByText("No certificates yet")).toBeInTheDocument();
  });

  it("says no rows match when filters hide everything", () => {
    render(
      <DataTable
        columns={columns}
        empty={<p>No certificates yet</p>}
        filtered
        label="Certificates"
        rowKey={(r) => r.serial}
        rows={[]}
      />,
    );
    expect(screen.getByText("No matching rows.")).toBeInTheDocument();
    expect(screen.queryByText("No certificates yet")).not.toBeInTheDocument();
  });

  it("shows the error content in the error state", () => {
    render(
      <DataTable
        columns={columns}
        error={<p>Couldn&apos;t load certificates</p>}
        label="Certificates"
        rowKey={(r) => r.serial}
        rows={rows}
        status="error"
      />,
    );
    expect(screen.getByText("Couldn't load certificates")).toBeInTheDocument();
    expect(screen.queryByText("api.example.org")).not.toBeInTheDocument();
  });

  it("stacks rows as cards on a phone", () => {
    setDesktop(false);
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        label="Certificates"
        onRowClick={onRowClick}
        rowKey={(r) => r.serial}
        rows={rows}
      />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Certificates" });
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("api.example.org")).toBeInTheDocument();
    expect(within(cards[0]).getByText("4A:07")).toBeInTheDocument();
    fireEvent.click(within(cards[1]).getByRole("button", { name: /web-01.example.org/ }));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });
});

describe("DataTablePagination", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <DataTablePagination
        canNext
        canPrevious={false}
        from={1}
        onNext={() => {}}
        onPrevious={() => {}}
        to={10}
        total={42}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("shows the range and pages", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(
      <DataTablePagination
        canNext
        canPrevious={false}
        from={1}
        onNext={onNext}
        onPrevious={onPrevious}
        to={10}
        total={42}
      />,
    );
    expect(screen.getByText("1–10 of 42")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("offers a page size choice", () => {
    const onPageSize = vi.fn();
    render(
      <DataTablePagination
        canNext={false}
        canPrevious={false}
        from={1}
        onNext={() => {}}
        onPageSize={onPageSize}
        onPrevious={() => {}}
        pageSize={10}
        to={2}
        total={2}
      />,
    );
    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "20" } });
    expect(onPageSize).toHaveBeenCalledWith(20);
  });
});
