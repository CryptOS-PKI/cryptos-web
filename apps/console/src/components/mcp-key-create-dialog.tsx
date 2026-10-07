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

import { useState } from "react";

import type { OperatorLevel } from "@/context/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ceilingsUpTo, createMcpKey } from "@/lib/mcp-keys";

const labelText = "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

// McpKeyCreateDialog mints an agent key for an MCP client that cannot run the
// browser sign-in. The plaintext lives only in this dialog's state: the page is
// told a key was made, never what it is, and closing the dialog discards it.
export const McpKeyCreateDialog = ({
  level,
  onClose,
  onCreated,
}: {
  level: OperatorLevel;
  onClose: () => void;
  onCreated: () => void;
}) => {
  const ceilings = ceilingsUpTo(level);
  const [label, setLabel] = useState("");
  const [ceiling, setCeiling] = useState<OperatorLevel>(level);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [plaintext, setPlaintext] = useState("");
  const [copy, setCopy] = useState<"copied" | "failed" | "idle">("idle");

  const close = () => {
    setPlaintext("");
    onClose();
  };

  const create = () => {
    setPending(true);
    setError(null);
    createMcpKey({ label: label.trim(), levelCeiling: ceiling })
      .then(({ plaintextKey }) => {
        setPlaintext(plaintextKey);
        setPending(false);
        onCreated();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Create failed");
        setPending(false);
      });
  };

  const copyKey = () => {
    globalThis.navigator.clipboard
      .writeText(plaintext)
      .then(() => setCopy("copied"))
      .catch(() => setCopy("failed"));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        // A stray click outside must not throw away a key nobody has copied yet.
        if (e.target === e.currentTarget && !plaintext) close();
      }}
      role="presentation"
    >
      <div
        aria-labelledby="mcp-key-create-title"
        aria-modal="true"
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl"
        role="dialog"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-bold" id="mcp-key-create-title">
            Create agent key
          </h2>
          <p className="text-xs text-muted-foreground">
            For an MCP client that cannot open the browser sign-in. The key acts as you, up to its
            ceiling, until it is revoked or your certificate is revoked or renewed.
          </p>
          <p className="text-xs text-muted-foreground">
            MCP needs a current CRL from your certificate&apos;s operator CA. Under a CA with no CRL
            source, or a CRL past its next update, the key is refused (error 1608).
          </p>
        </div>

        {plaintext ? (
          <>
            <p
              className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-muted-foreground"
              role="note"
            >
              Copy this key into your MCP client now. It will not be shown again, and the manager
              keeps only a hash of it.
            </p>
            <code className="block select-all break-all rounded-md border bg-secondary px-3 py-2 font-mono text-xs">
              {plaintext}
            </code>
            {copy === "failed" ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                Could not reach the clipboard. Select the key above and copy it.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button onClick={copyKey} size="sm" variant="outline">
                {copy === "copied" ? "Copied" : "Copy key"}
              </Button>
              <Button onClick={close} size="sm">
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <label className="block space-y-1">
              <span className={labelText}>Label</span>
              <Input
                disabled={pending}
                maxLength={120}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. build agent"
                value={label}
              />
            </label>
            <label className="block space-y-1">
              <span className={labelText}>Level ceiling</span>
              <select
                className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm"
                disabled={pending}
                onChange={(e) => setCeiling(e.target.value as OperatorLevel)}
                value={ceiling}
              >
                {ceilings.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p className="font-mono text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button disabled={pending} onClick={close} size="sm" variant="outline">
                Cancel
              </Button>
              <Button disabled={pending} onClick={create} size="sm">
                {pending ? "Creating…" : "Create key"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
