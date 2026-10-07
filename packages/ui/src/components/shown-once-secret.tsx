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

import { IconApprove, IconCopy, IconWarning } from "../icons";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { useCopy } from "./copy-block";

export interface ShownOnceSecretProps {
  className?: string;
  doneLabel?: string;
  label: string;
  onDone: () => void;
  secret: string;
  warning: React.ReactNode;
}

// ShownOnceSecret shows a value the manager keeps only a hash of (an agent key,
// say): the warning, the value, Copy and Done.
export const ShownOnceSecret = ({
  className,
  doneLabel = "Done",
  label,
  onDone,
  secret,
  warning,
}: ShownOnceSecretProps) => {
  const { copied, copy } = useCopy(secret);
  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="flex gap-3 rounded-md border border-l-4 border-warning/40 border-l-warning bg-warning/10 px-3.5 py-3 text-[13px]"
        role="note"
      >
        <IconWarning className="mt-0.5 size-4 shrink-0 text-warning" />
        <div>{warning}</div>
      </div>
      <code
        aria-label={label}
        className="block select-all break-all rounded-md border bg-background px-3 py-2.5 font-mono text-[13px]"
      >
        {secret}
      </code>
      <div className="flex items-center gap-2">
        <Button
          className={cn(copied && "border-success/50 text-success")}
          onClick={() => void copy()}
          size="sm"
          variant="outline"
        >
          {copied ? <IconApprove /> : <IconCopy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button className="ml-auto" onClick={onDone} size="sm">
          {doneLabel}
        </Button>
      </div>
    </div>
  );
};
