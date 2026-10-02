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

import { CircleAlert } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn";

export interface FieldProps {
  /** A tag beside the label, such as "NEEDS REBOOT". */
  badge?: React.ReactNode;
  /** The control: an Input, a select or a textarea. */
  children: React.ReactElement<Record<string, unknown>>;
  className?: string;
  /** The rejection message. Replaces the help text and marks the control invalid. */
  error?: React.ReactNode;
  help?: React.ReactNode;
  label: React.ReactNode;
}

// Field lays out a label, its control and one line of help or error, and wires
// the label, description and invalid state onto the control.
export const Field = ({ badge, children, className, error, help, label }: FieldProps) => {
  const generated = React.useId();
  const id = (children.props.id as string | undefined) ?? generated;
  const noteId = `${id}-note`;
  const note = error ?? help;

  const control = React.cloneElement(children, {
    "aria-describedby": note ? noteId : undefined,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    id,
  });

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <label className="text-[13px] font-semibold text-foreground" htmlFor={id}>
          {label}
        </label>
        {badge ? (
          <span className="rounded-sm border border-warning/40 bg-warning/10 px-1.5 font-mono text-[10px] font-semibold tracking-wide text-warning">
            {badge}
          </span>
        ) : null}
      </div>
      {control}
      {error ? (
        <p className="flex items-start gap-1.5 text-xs text-destructive" id={noteId} role="alert">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      {!error && help ? (
        <p className="text-xs text-muted-foreground" id={noteId}>
          {help}
        </p>
      ) : null}
    </div>
  );
};
