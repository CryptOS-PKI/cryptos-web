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

import type {
  Column,
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";

import { ColumnHeader } from "./column-header";
import { Pagination } from "./pagination";

export type FacetConfig = {
  columnId: string;
  optionLabel?: (value: string) => string;
  title: string;
};

// A facet select stores its single choice as a one-element array; a text filter
// stores the query the same way. Both filter functions read that shape.
const selectFilterFn: FilterFn<unknown> = (row, columnId, value) =>
  !Array.isArray(value) || value.length === 0 || value.includes(String(row.getValue(columnId)));

const textFilterFn: FilterFn<unknown> = (row, columnId, value) => {
  const query = Array.isArray(value) ? value[0] : value;
  if (!query) return true;
  return String(row.getValue(columnId)).toLowerCase().includes(String(query).toLowerCase());
};

const columnId = (col: ColumnDef<unknown, unknown>) =>
  col.id ?? ("accessorKey" in col ? String(col.accessorKey) : "");

export const DataTable = <T,>({
  columns,
  data,
  facets = [],
  initialSort = [],
  pageSize = 10,
  searchKeys = [],
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  facets?: FacetConfig[];
  initialSort?: SortingState;
  pageSize?: number;
  searchKeys?: string[];
}) => {
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });

  const facetById = useMemo(() => new Map(facets.map((f) => [f.columnId, f])), [facets]);
  const searchSet = useMemo(() => new Set(searchKeys), [searchKeys]);
  const hasFilters = facets.length > 0 || searchKeys.length > 0;

  const preparedColumns = useMemo(
    () =>
      columns.map((col): ColumnDef<T, unknown> => {
        const id = columnId(col as ColumnDef<unknown, unknown>);
        if (facetById.has(id))
          return { ...col, enableColumnFilter: true, filterFn: selectFilterFn } as ColumnDef<
            T,
            unknown
          >;
        if (searchSet.has(id))
          return { ...col, enableColumnFilter: true, filterFn: textFilterFn } as ColumnDef<
            T,
            unknown
          >;
        return { ...col, enableColumnFilter: false } as ColumnDef<T, unknown>;
      }),
    [columns, facetById, searchSet],
  );

  const table = useReactTable({
    columns: preparedColumns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    sortDescFirst: false,
    state: {
      columnFilters,
      pagination,
      sorting,
    },
  });

  const rows = table.getRowModel().rows;
  const colCount = table.getAllLeafColumns().length;

  const distinctValues = (id: string) => {
    const values = new Set<string>();
    for (const row of table.getCoreRowModel().flatRows) {
      const raw = row.getValue(id);
      if (raw == null || raw === "") continue;
      values.add(String(raw));
    }
    // eslint-disable-next-line unicorn/no-array-sort
    return [...values].sort((a, b) => a.localeCompare(b));
  };

  const renderFilter = (col: Column<T, unknown>) => {
    const selected = (col.getFilterValue() as string[] | undefined) ?? [];
    const facet = facetById.get(col.id);
    if (facet) {
      return (
        <select
          aria-label={`Filter ${facet.title}`}
          className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-foreground"
          onChange={(event) =>
            col.setFilterValue(event.target.value ? [event.target.value] : undefined)
          }
          value={selected[0] ?? ""}
        >
          <option value="">All</option>
          {distinctValues(col.id).map((value) => (
            <option key={value} value={value}>
              {facet.optionLabel ? facet.optionLabel(value) : value}
            </option>
          ))}
        </select>
      );
    }
    if (searchSet.has(col.id)) {
      return (
        <Input
          aria-label={`Filter ${col.id}`}
          className="h-7"
          onChange={(event) =>
            col.setFilterValue(event.target.value ? [event.target.value] : undefined)
          }
          placeholder="Filter..."
          value={selected[0] ?? ""}
        />
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-secondary text-[10.5px] text-muted-foreground">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  // eslint-disable-next-line unicorn/no-nested-ternary
                  const headerCell = h.isPlaceholder ? null : h.column.getCanSort() ? (
                    <ColumnHeader column={h.column} title={String(h.column.columnDef.header)} />
                  ) : (
                    <span className="uppercase tracking-wider">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </span>
                  );
                  return (
                    <th className="px-3 py-2" key={h.id}>
                      {headerCell}
                    </th>
                  );
                })}
              </tr>
            ))}
            {hasFilters && (
              <tr className="border-t border-border/60">
                {table.getVisibleLeafColumns().map((col) => (
                  <th className="px-3 pb-2" key={col.id}>
                    {renderFilter(col)}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={colCount}>
                  No matching rows.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr className="border-t hover:bg-accent" key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td className="px-3 py-2" key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination table={table} />
    </div>
  );
};
