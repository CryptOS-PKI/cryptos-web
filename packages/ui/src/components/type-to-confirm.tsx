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
import { Input } from "./input";

const asList = (expected: string | string[]) => (Array.isArray(expected) ? expected : [expected]);

/** Exact, case-sensitive match against the expected text (or any of several). */
export const typedMatches = (value: string, expected: string | string[]) =>
  asList(expected).includes(value);

export interface TypeToConfirmProps {
  className?: string;
  expected: string | string[];
  id?: string;
  /** Replaces the "Type … to confirm" prompt. */
  label?: React.ReactNode;
  onChange: (value: string) => void;
  value: string;
}

// TypeToConfirm guards a destructive action: the operator types the exact
// text shown. The caller keeps its button disabled until typedMatches is true.
export const TypeToConfirm = ({
  className,
  expected,
  id,
  label,
  onChange,
  value,
}: TypeToConfirmProps) => {
  const generated = React.useId();
  const inputId = id ?? generated;
  const options = asList(expected);
  const matches = typedMatches(value, expected);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-[13px]" htmlFor={inputId}>
        {label ?? (
          <>
            Type{" "}
            {options.map((option, index) => (
              <React.Fragment key={option}>
                {index > 0 ? <span> or </span> : null}
                <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                  {option}
                </code>
              </React.Fragment>
            ))}{" "}
            to confirm
          </>
        )}
      </label>
      <div className="relative">
        <Input
          autoCapitalize="off"
          autoComplete="off"
          className={cn(
            "pr-9",
            matches && "border-success focus-visible:border-success focus-visible:ring-success",
          )}
          id={inputId}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          value={value}
        />
        {matches ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="confirm-match">
            <IconApprove className="size-4 text-success" />
          </span>
        ) : null}
      </div>
    </div>
  );
};
