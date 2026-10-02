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

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Mark the value as rejected (red border, aria-invalid). */
  invalid?: boolean;
  /** Values (addresses, tokens, CNs) are set in mono; turn off for prose. */
  mono?: boolean;
}

export const inputClasses =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-muted/40 read-only:text-muted-foreground aria-[invalid=true]:border-destructive";

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid = false, mono = true, ...props }, ref) => (
    <input
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(
        inputClasses,
        mono ? "font-mono" : "font-sans",
        invalid &&
          "border-destructive focus-visible:border-destructive focus-visible:ring-destructive",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";
