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

import { IconApprove, IconDeny, IconPending } from "../icons";
import { cn } from "../lib/cn";

export interface Phase {
  detail?: React.ReactNode;
  id: string;
  label: React.ReactNode;
  state: "current" | "done" | "failed" | "pending";
}

// PhaseRail shows a server-driven sequence (adoption, upgrade) as a vertical
// rail. It is a polite live region, so each phase change is announced; a
// failed phase turns red with its coded error and the rail stops there.
export const PhaseRail = ({
  className,
  label,
  phases,
}: {
  className?: string;
  label: string;
  phases: Phase[];
}) => (
  <div aria-live="polite" className={cn("rounded-lg border bg-card px-5 py-4", className)}>
    <ol aria-label={label}>
      {phases.map((phase, index) => {
        const last = index === phases.length - 1;
        return (
          <li
            aria-current={phase.state === "current" ? "step" : undefined}
            className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3"
            data-state={phase.state}
            key={phase.id}
          >
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 items-center justify-center rounded-full",
                  phase.state === "done" && "bg-success text-success-foreground",
                  phase.state === "current" && "border-2 border-warning text-warning",
                  phase.state === "pending" && "border border-border",
                  phase.state === "failed" && "bg-destructive text-destructive-foreground",
                )}
              >
                {phase.state === "done" ? <IconApprove className="size-3" /> : null}
                {phase.state === "current" ? <IconPending className="size-2.5" /> : null}
                {phase.state === "failed" ? <IconDeny className="size-3" /> : null}
              </span>
              {last ? null : (
                <span
                  className={cn(
                    "my-0.5 w-0.5 flex-1",
                    phase.state === "done" ? "bg-success" : "bg-border",
                  )}
                />
              )}
            </div>
            <div className={cn("min-w-0", last ? "pb-0" : "pb-3")}>
              <p
                className={cn(
                  "font-mono text-[13px]",
                  phase.state === "pending" && "text-muted-foreground",
                  phase.state === "failed" && "font-semibold text-destructive",
                  (phase.state === "done" || phase.state === "current") &&
                    "font-medium text-foreground",
                )}
              >
                {phase.label}
              </p>
              {phase.detail ? (
                <p className="text-xs text-muted-foreground">{phase.detail}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  </div>
);
