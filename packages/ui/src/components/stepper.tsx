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

import { IconApprove } from "../icons";
import { cn } from "../lib/cn";

const stepState = (index: number, current: number) => {
  if (index < current) return "done";
  if (index === current) return "current";
  return "upcoming";
};

export interface StepperProps {
  /** Whether a done step may be revisited; defaults to every done step. */
  canRevisit?: (index: number) => boolean;
  className?: string;
  current: number;
  label?: string;
  onStepClick?: (index: number) => void;
  steps: { id: string; label: React.ReactNode }[];
}

// Stepper is the wizard strip: done steps get a green check and stay clickable
// when going back is safe; the current step has a ring and bold text.
export const Stepper = ({
  canRevisit = () => true,
  className,
  current,
  label = "Progress",
  onStepClick,
  steps,
}: StepperProps) => (
  <ol
    aria-label={label}
    className={cn(
      "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-4 py-3",
      className,
    )}
  >
    {steps.map((step, index) => {
      const state = stepState(index, current);
      const marker = (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px]",
            state === "done" && "bg-success text-success-foreground",
            state === "current" && "border-2 border-primary text-primary",
            state === "upcoming" && "border border-border text-muted-foreground",
          )}
        >
          {state === "done" ? <IconApprove className="size-3.5" /> : index + 1}
        </span>
      );
      const text = (
        <span
          className={cn(
            "font-mono text-[13px]",
            state === "current" ? "font-bold text-foreground" : "text-muted-foreground",
          )}
        >
          {step.label}
        </span>
      );
      const clickable = state === "done" && onStepClick && canRevisit(index);
      return (
        <li
          aria-current={state === "current" ? "step" : undefined}
          className="flex items-center gap-3"
          data-state={state}
          key={step.id}
        >
          {index > 0 ? (
            <span
              aria-hidden="true"
              className={cn(
                "hidden h-px w-10 sm:block lg:w-16",
                index <= current ? "bg-success" : "bg-border",
              )}
            />
          ) : null}
          {clickable ? (
            <button
              className="flex items-center gap-2 rounded hover:underline"
              onClick={() => onStepClick(index)}
              type="button"
            >
              {marker}
              {text}
            </button>
          ) : (
            <span className="flex items-center gap-2">
              {marker}
              {text}
            </span>
          )}
        </li>
      );
    })}
  </ol>
);
