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

import { Button } from "@/components/ui/button";
import { downloadText } from "@/lib/download";

// CopyBlock shows generated text (a CSR, an OpenSSL section, a command) with a
// copy button and, when a filename is given, a download button.
export const CopyBlock = ({
  filename,
  label,
  text,
}: {
  filename?: string;
  label: string;
  text: string;
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex gap-2">
        <Button
          aria-label={`Copy ${label}`}
          onClick={() => void navigator.clipboard?.writeText(text)}
          size="sm"
          type="button"
          variant="outline"
        >
          Copy
        </Button>
        {filename ? (
          <Button
            aria-label={`Download ${label}`}
            onClick={() => downloadText(filename, text)}
            size="sm"
            type="button"
            variant="outline"
          >
            Download
          </Button>
        ) : null}
      </div>
    </div>
    <pre
      aria-label={label}
      className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-secondary/40 p-2 font-mono text-[11px]"
    >
      {text}
    </pre>
  </div>
);
