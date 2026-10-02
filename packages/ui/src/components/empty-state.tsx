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

import type { LucideIcon } from "lucide-react";

import * as React from "react";

import { cn } from "../lib/cn";

export interface EmptyStateProps {
  action?: React.ReactNode;
  body?: React.ReactNode;
  className?: string;
  footnote?: React.ReactNode;
  /** A lucide icon drawn in the dashed tile. */
  icon?: LucideIcon;
  /** A full illustration; replaces the icon tile. */
  illustration?: React.ReactNode;
  title: React.ReactNode;
  tone?: "danger" | "muted";
}

// EmptyState fills a list or page with nothing to show: an icon tile or an
// illustration, a title, one line of body and the next action. The danger tone
// is the error state ("Couldn't load ...") and is announced.
export const EmptyState = ({
  action,
  body,
  className,
  footnote,
  icon: Icon,
  illustration,
  title,
  tone = "muted",
}: EmptyStateProps) => {
  const danger = tone === "danger";
  return (
    <div
      className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}
      role={danger ? "alert" : undefined}
    >
      {illustration ??
        (Icon ? (
          <span
            aria-hidden="true"
            className={cn(
              "flex size-14 items-center justify-center rounded-lg border",
              danger
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-dashed border-muted-foreground/50 text-muted-foreground",
            )}
          >
            <Icon className="size-6" strokeWidth={1.75} />
          </span>
        ) : null)}
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {body ? <div className="max-w-sm text-[13px] text-muted-foreground">{body}</div> : null}
      {action ? <div className="flex flex-wrap justify-center gap-2">{action}</div> : null}
      {footnote ? <p className="text-xs text-muted-foreground/80">{footnote}</p> : null}
    </div>
  );
};
