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

import type { Table } from "@tanstack/react-table";

const PAGE_SIZES = [10, 20, 30, 50];

export const Pagination = <T,>({ table }: { table: Table<T> }) => {
  const { pageIndex, pageSize } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(1, table.getPageCount());
  const start = total === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min(total, (pageIndex + 1) * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2 font-mono text-xs text-muted-foreground">
      <span>
        {start}
        {"\u2013"}
        {end} of {total}
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          Rows per page
          <select
            aria-label="Rows per page"
            className="h-7 rounded-md border border-input bg-background px-1.5 text-foreground"
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            value={pageSize}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span>
          Page {pageIndex + 1} of {pageCount}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-md border px-2 py-1 disabled:opacity-40 enabled:hover:bg-accent"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            type="button"
          >
            Prev
          </button>
          <button
            className="rounded-md border px-2 py-1 disabled:opacity-40 enabled:hover:bg-accent"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
