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

import { Download } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { useCopy } from "./copy-block";
import { Notice } from "./notice";

export interface KeyBackupStepProps {
  className?: string;
  continueLabel?: string;
  filename: string;
  onContinue: () => void;
  /** Save the encrypted backup; the step records that it happened. */
  onDownload: () => void;
  passphrase: string;
  warning: React.ReactNode;
}

// KeyBackupStep is the save-your-key step of the credential wizards: the
// warning, the passphrase shown once, the backup download and the "I have
// saved the passphrase" check. Continue enables only after both.
export const KeyBackupStep = ({
  className,
  continueLabel = "Continue",
  filename,
  onContinue,
  onDownload,
  passphrase,
  warning,
}: KeyBackupStepProps) => {
  const [downloaded, setDownloaded] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const { copied, copy } = useCopy(passphrase);
  const checkId = React.useId();

  return (
    <div className={cn("space-y-4", className)}>
      <Notice role="note" tone="danger">
        {warning}
      </Notice>
      <div className="space-y-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          Passphrase · shown once
        </span>
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
          <code
            aria-label="Key backup passphrase"
            className="flex-1 select-all break-all font-mono text-sm"
          >
            {passphrase}
          </code>
          <button
            className={cn(
              "text-xs",
              copied ? "text-success" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => void copy()}
            type="button"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <Button
        className="h-auto min-h-8 whitespace-normal py-1.5 text-left"
        onClick={() => {
          onDownload();
          setDownloaded(true);
        }}
        size="sm"
        variant="secondary"
      >
        <Download aria-hidden="true" />
        Download key backup · {filename}
      </Button>
      <div className="flex items-center gap-2 text-[13px]">
        <input
          checked={saved}
          className="size-4 accent-[hsl(var(--primary))]"
          id={checkId}
          onChange={(event) => setSaved(event.target.checked)}
          type="checkbox"
        />
        <label htmlFor={checkId}>I have saved the passphrase</label>
      </div>
      <div className="flex justify-end">
        <Button disabled={!downloaded || !saved} onClick={onContinue} size="sm">
          {continueLabel}
        </Button>
      </div>
    </div>
  );
};
