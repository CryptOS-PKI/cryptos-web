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

import type { Column } from "@tanstack/react-table";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export const ColumnHeader = <T,>({
  column,
  title,
}: {
  column: Column<T, unknown>;
  title: string;
}) => {
  const sorted = column.getIsSorted();
  // eslint-disable-next-line unicorn/no-nested-ternary
  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <button
      className={cn(
        "-ml-2 inline-flex h-7 items-center gap-1 rounded-md px-2 uppercase tracking-wider",
        "hover:bg-accent hover:text-foreground",
        sorted && "text-foreground",
      )}
      onClick={column.getToggleSortingHandler()}
      type="button"
    >
      <span>{title}</span>
      <SortIcon className={cn("size-3.5", sorted ? "opacity-100" : "opacity-40")} />
    </button>
  );
};
