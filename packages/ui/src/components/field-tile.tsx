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

import { cn } from "../lib/cn";

const LIST_LIMIT = 4;

const columnClass = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
} as const;

// FieldTiles is the hairline-separated grid of label/value tiles used on the
// detail pages. It is a description list, so each tile is a term and its value.
export const FieldTiles = ({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}) => (
  <dl
    className={cn(
      "grid gap-px overflow-hidden rounded-lg border bg-border",
      columnClass[columns],
      className,
    )}
  >
    {children}
  </dl>
);

export interface FieldTileProps {
  className?: string;
  /** Span the whole row (URLs, SANs, fingerprints). */
  full?: boolean;
  label: React.ReactNode;
  mono?: boolean;
  /** Text colour for a state value. */
  tone?: "danger" | "success" | "warning";
  value: null | React.ReactNode | string[];
}

const toneText = {
  danger: "text-foreground dark:text-destructive",
  success: "text-foreground dark:text-success",
  warning: "text-foreground dark:text-warning",
} as const;

const ListValue = ({ items }: { items: string[] }) => {
  const [all, setAll] = React.useState(false);
  const shown = all ? items : items.slice(0, LIST_LIMIT);
  return (
    <span>
      {shown.join(", ")}
      {items.length > LIST_LIMIT && !all ? (
        <>
          {" … "}
          <button
            className="text-primary hover:underline"
            onClick={() => setAll(true)}
            type="button"
          >
            Show all {items.length}
          </button>
        </>
      ) : null}
    </span>
  );
};

export const FieldTile = ({
  className,
  full = false,
  label,
  mono = true,
  tone,
  value,
}: FieldTileProps) => {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
  let content: React.ReactNode;
  if (isEmpty) content = <span className="text-muted-foreground">—</span>;
  else if (Array.isArray(value)) content = <ListValue items={value} />;
  else content = <span className={tone ? toneText[tone] : undefined}>{value}</span>;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 bg-card px-3.5 py-2.5",
        full && "col-span-full",
        className,
      )}
    >
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("min-w-0 break-words text-[13px]", mono && "font-mono")}>{content}</dd>
    </div>
  );
};
