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

import { IconApprove, IconCopy, IconDownload } from "../icons";
import { cn } from "../lib/cn";

const COPIED_MS = 2000;

/** Save text as a file through a temporary blob link. */
export const downloadTextFile = (filename: string, text: string, type = "text/plain") => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Copy feedback: copy() writes to the clipboard and copied stays true for two seconds. */
export const useCopy = (text: string) => {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = React.useCallback(async () => {
    await navigator.clipboard?.writeText(text);
    setCopied(true);
  }, [text]);
  return { copied, copy };
};

export interface CopyBlockProps {
  className?: string;
  filename?: string;
  label: string;
  mime?: string;
  /** Replace the built-in blob download (the console's own download helper, say). */
  onDownload?: (filename: string, text: string) => void;
  text: string;
}

// CopyBlock shows generated text (a CSR, a command, a config section) in a
// mono block with Copy and, when a filename is given, Download.
export const CopyBlock = ({
  className,
  filename,
  label,
  mime,
  onDownload,
  text,
}: CopyBlockProps) => {
  const { copied, copy } = useCopy(text);
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-background", className)}>
      <div className="flex items-center gap-3 border-b px-3 py-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <div className="ml-auto flex gap-3">
          <button
            aria-label={`Copy ${label}`}
            className={cn(
              "inline-flex items-center gap-1 text-xs",
              copied ? "text-success" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => void copy()}
            type="button"
          >
            {copied ? <IconApprove className="size-3.5" /> : <IconCopy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          {filename ? (
            <button
              aria-label={`Download ${label}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() =>
                onDownload ? onDownload(filename, text) : downloadTextFile(filename, text, mime)
              }
              type="button"
            >
              <IconDownload className="size-3.5" />
              Download
            </button>
          ) : null}
        </div>
      </div>
      <pre
        aria-label={label}
        className="max-h-60 overflow-auto whitespace-pre-wrap break-all px-3 py-2.5 font-mono text-xs leading-relaxed"
      >
        {text}
      </pre>
    </div>
  );
};
