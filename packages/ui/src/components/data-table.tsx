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

import * as React from "react";

import { IconChevDown } from "../icons";
import { cn } from "../lib/cn";
import { useIsDesktop } from "../lib/use-media-query";

export interface DataTableColumn<T> {
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** A control for the filter row under the header. */
  filter?: React.ReactNode;
  header: React.ReactNode;
  id: string;
  /**
   * The column's place in a phone card: the title line, a meta line, the action
   * at the end, or left out. Defaults to meta.
   */
  mobile?: "action" | "hidden" | "meta" | "title";
  onSort?: () => void;
  sort?: "asc" | "desc" | false;
}

export interface DataTableProps<T> {
  className?: string;
  columns: DataTableColumn<T>[];
  /** Shown when there are no rows and nothing is filtered (usually an EmptyState). */
  empty?: React.ReactNode;
  /** Shown in place of the rows in the error state. */
  error?: React.ReactNode;
  /** Rows are empty because of filters, so say no rows match instead of the empty state. */
  filtered?: boolean;
  /** Pagination or other content under the table. */
  footer?: React.ReactNode;
  /** The row a deep link points at: tinted, edged, current and scrolled to. */
  highlightKey?: string;
  label: string;
  noMatches?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  rows: T[];
  skeletonRows?: number;
  status?: "error" | "loading" | "ready";
}

const ariaSort = (sort: DataTableColumn<unknown>["sort"]) => {
  if (sort === "asc") return "ascending";
  if (sort === "desc") return "descending";
  return;
};

// No dedicated ascending/unsorted glyphs in the kit: ascending rotates the
// same down chevron, and unsorted is the down chevron dimmed.
const SortIcon = ({ sort }: { sort: DataTableColumn<unknown>["sort"] }) => {
  if (sort === "asc") return <IconChevDown className="size-3 rotate-180" />;
  if (sort === "desc") return <IconChevDown className="size-3" />;
  return <IconChevDown className="size-3 opacity-40" />;
};

const Message = ({ children }: { children: React.ReactNode }) => (
  <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">{children}</div>
);

// DataTable is the console's list: a mono header strip, an optional filter row,
// rows that open on click or Enter, and the loading, empty, filtered-to-nothing
// and error states. Below 768 px the rows become stacked cards.
export const DataTable = <T,>({
  className,
  columns,
  empty,
  error,
  filtered = false,
  footer,
  highlightKey,
  label,
  noMatches = "No matching rows.",
  onRowClick,
  rowKey,
  rows,
  skeletonRows = 5,
  status = "ready",
}: DataTableProps<T>) => {
  const desktop = useIsDesktop();
  const highlighted = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    highlighted.current?.scrollIntoView?.({ block: "center" });
  }, [highlightKey, status]);

  const hasFilters = columns.some((c) => c.filter);
  const loading = status === "loading";
  const failed = status === "error";
  const nothing = !loading && !failed && rows.length === 0;

  const emptyContent = filtered ? (
    <Message>{noMatches}</Message>
  ) : (
    (empty ?? <Message>{noMatches}</Message>)
  );

  const rowProps = (row: T) => {
    const key = rowKey(row);
    const isHighlighted = highlightKey !== undefined && key === highlightKey;
    return {
      "aria-current": isHighlighted ? ("true" as const) : undefined,
      "data-highlighted": isHighlighted ? "true" : undefined,
      key,
      ref: isHighlighted
        ? (el: HTMLElement | null) => {
            highlighted.current = el;
          }
        : undefined,
    };
  };

  if (!desktop) {
    const title = columns.find((c) => c.mobile === "title") ?? columns[0];
    const action = columns.find((c) => c.mobile === "action");
    const meta = columns.filter(
      (c) => c !== title && c !== action && c.mobile !== "hidden" && c.mobile !== "title",
    );
    const card = (row: T) => {
      const { key, ref, ...attrs } = rowProps(row);
      const body = (
        <>
          <span className="block truncate font-mono text-[13px] text-foreground">
            {title.cell(row)}
          </span>
          {meta.length > 0 ? (
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
              {meta.map((c, i) => (
                <React.Fragment key={c.id}>
                  {i > 0 ? <span aria-hidden="true">·</span> : null}
                  <span>{c.cell(row)}</span>
                </React.Fragment>
              ))}
            </span>
          ) : null}
        </>
      );
      return (
        <li
          className={cn(
            "flex items-start gap-3 rounded-lg border bg-card px-3.5 py-3",
            attrs["data-highlighted"] && "border-primary bg-primary/10",
          )}
          key={key}
          ref={ref}
          {...attrs}
        >
          {onRowClick ? (
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => onRowClick(row)}
              type="button"
            >
              {body}
            </button>
          ) : (
            <div className="min-w-0 flex-1">{body}</div>
          )}
          {action ? <div className="shrink-0">{action.cell(row)}</div> : null}
        </li>
      );
    };

    const phoneBody = () => {
      if (loading)
        return (
          <div aria-busy="true" aria-label={label} className="space-y-2">
            {Array.from({ length: skeletonRows }, (_, i) => (
              <div
                className="h-16 animate-shimmer rounded-lg border bg-muted/50"
                data-skeleton
                key={i}
              />
            ))}
          </div>
        );
      if (failed) return <div className="rounded-lg border bg-card">{error}</div>;
      if (nothing) return <div className="rounded-lg border bg-card">{emptyContent}</div>;
      return (
        <ul aria-label={label} className="space-y-2">
          {rows.map((row) => card(row))}
        </ul>
      );
    };

    return (
      <div className={cn("space-y-3", className)}>
        {hasFilters ? (
          <div className="grid gap-2">
            {columns.map((c) => (c.filter ? <div key={c.id}>{c.filter}</div> : null))}
          </div>
        ) : null}
        {phoneBody()}
        {footer}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <div className="overflow-x-auto">
        <table
          aria-busy={loading || undefined}
          aria-label={label}
          className="w-full text-left text-[13px]"
        >
          <thead className="border-b font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th
                  aria-sort={ariaSort(c.sort)}
                  className={cn("h-10 px-4 font-medium", c.className)}
                  key={c.id}
                  scope="col"
                >
                  {c.onSort ? (
                    <button
                      className={cn(
                        "-ml-1.5 inline-flex h-7 items-center gap-1 rounded px-1.5 uppercase tracking-[0.08em] hover:bg-secondary hover:text-foreground",
                        c.sort && "text-foreground",
                      )}
                      onClick={c.onSort}
                      type="button"
                    >
                      {c.header}
                      <SortIcon sort={c.sort} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
            {hasFilters ? (
              <tr className="border-t normal-case tracking-normal">
                {columns.map((c) => (
                  <th className="px-2.5 py-2 font-normal" key={c.id}>
                    {c.filter}
                  </th>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr className="border-b last:border-b-0" data-skeleton key={i}>
                    {columns.map((c) => (
                      <td className="px-4 py-3" key={c.id}>
                        <span className="block h-3 w-3/4 animate-shimmer rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {failed ? (
              <tr>
                <td colSpan={columns.length}>{error}</td>
              </tr>
            ) : null}
            {nothing ? (
              <tr>
                <td colSpan={columns.length}>{emptyContent}</td>
              </tr>
            ) : null}
            {!loading && !failed
              ? rows.map((row) => {
                  const { key, ref, ...attrs } = rowProps(row);
                  return (
                    <tr
                      className={cn(
                        "h-[43px] border-b transition-colors last:border-b-0",
                        onRowClick &&
                          "cursor-pointer hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:outline-none",
                        attrs["data-highlighted"] &&
                          "bg-primary/10 shadow-[inset_2px_0_0_hsl(var(--primary))]",
                      )}
                      key={key}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={
                        onRowClick
                          ? (event) => {
                              if (event.key === "Enter" && event.target === event.currentTarget)
                                onRowClick(row);
                            }
                          : undefined
                      }
                      ref={ref}
                      tabIndex={onRowClick ? 0 : undefined}
                      {...attrs}
                    >
                      {columns.map((c) => (
                        <td className={cn("px-4 py-2", c.className)} key={c.id}>
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
      {footer ? <div className="border-t">{footer}</div> : null}
    </div>
  );
};

export interface DataTablePaginationProps {
  canNext: boolean;
  canPrevious: boolean;
  className?: string;
  from: number;
  onNext: () => void;
  onPageSize?: (size: number) => void;
  onPrevious: () => void;
  /** "Page 2 of 5", when the caller wants it shown. */
  pageLabel?: React.ReactNode;
  pageSize?: number;
  pageSizes?: number[];
  to: number;
  total: number;
}

export const DataTablePagination = ({
  canNext,
  canPrevious,
  className,
  from,
  onNext,
  onPageSize,
  onPrevious,
  pageLabel,
  pageSize,
  pageSizes = [10, 20, 30, 50],
  to,
  total,
}: DataTablePaginationProps) => (
  <div
    className={cn(
      "flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-[13px] text-muted-foreground",
      className,
    )}
  >
    <span>
      {from}
      {"–"}
      {to} of {total}
    </span>
    {onPageSize && pageSize !== undefined ? (
      <label className="flex items-center gap-2">
        Rows per page
        <select
          aria-label="Rows per page"
          className="h-7 rounded border bg-background px-1.5 font-mono text-xs text-foreground"
          onChange={(event) => onPageSize(Number(event.target.value))}
          value={pageSize}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    ) : null}
    {pageLabel ? <span>{pageLabel}</span> : null}
    <div className="ml-auto flex gap-2">
      <button
        className="h-8 rounded-md border px-3 text-[13px] text-foreground enabled:hover:bg-secondary disabled:text-muted-foreground/60"
        disabled={!canPrevious}
        onClick={onPrevious}
        type="button"
      >
        Prev
      </button>
      <button
        className="h-8 rounded-md border px-3 text-[13px] text-foreground enabled:hover:bg-secondary disabled:text-muted-foreground/60"
        disabled={!canNext}
        onClick={onNext}
        type="button"
      >
        Next
      </button>
    </div>
  </div>
);
