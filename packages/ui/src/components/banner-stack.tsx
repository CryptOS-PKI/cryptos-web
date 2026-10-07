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

import { IconDanger, IconWarning } from "../icons";
import { cn } from "../lib/cn";

export interface BannerItem {
  action?: { href?: string; label: string; onClick?: () => void };
  body?: React.ReactNode;
  id: string;
  title: React.ReactNode;
  tone: "danger" | "warning";
}

// BannerStack shows page-level problems in one bordered stack: danger items
// before warnings, the first `limit` shown and the rest behind "+N more". Each
// item has at most one action.
export const BannerStack = ({
  className,
  items,
  limit = 3,
}: {
  className?: string;
  items: BannerItem[];
  limit?: number;
}) => {
  const [expanded, setExpanded] = React.useState(false);
  if (items.length === 0) return null;

  const ordered = [
    ...items.filter((i) => i.tone === "danger"),
    ...items.filter((i) => i.tone !== "danger"),
  ];
  const shown = expanded ? ordered : ordered.slice(0, limit);
  const hidden = ordered.length - limit;

  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      <ul>
        {shown.map((item) => {
          const danger = item.tone === "danger";
          const Icon = danger ? IconDanger : IconWarning;
          return (
            <li
              className={cn(
                "flex gap-3 border-b px-4 py-3 last:border-b-0",
                danger ? "bg-destructive/10" : "bg-warning/10",
              )}
              key={item.id}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  danger ? "text-destructive" : "text-warning",
                )}
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-semibold">{item.title}</h3>
                {item.body ? (
                  <div className="mt-0.5 text-[13px] text-foreground/80">{item.body}</div>
                ) : null}
              </div>
              {item.action ? (
                item.action.href ? (
                  <a
                    className="whitespace-nowrap text-xs text-primary hover:underline"
                    href={item.action.href}
                    onClick={item.action.onClick}
                  >
                    {item.action.label}
                  </a>
                ) : (
                  <button
                    className="h-fit whitespace-nowrap text-xs text-primary hover:underline"
                    onClick={item.action.onClick}
                    type="button"
                  >
                    {item.action.label}
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <button
          aria-expanded={expanded}
          className="w-full border-t bg-card px-4 py-1.5 text-right text-xs text-primary hover:underline"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          {expanded ? "Show fewer" : `+${hidden} more`}
        </button>
      ) : null}
    </div>
  );
};
