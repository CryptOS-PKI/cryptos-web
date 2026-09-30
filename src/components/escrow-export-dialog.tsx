/*
Apache License 2.0

Copyright 2026 Shane

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

import { Button } from "@/components/ui/button";
import { exportCAKey, generateStrongPassphrase, MIN_PASSPHRASE_LENGTH } from "@/lib/escrow";

// download triggers a browser download of the encrypted envelope without
// leaving a URL object behind. The envelope is opaque bytes; it is never
// rendered on screen. The bytes are copied into a fresh ArrayBuffer-backed view
// so the Blob part type is unambiguous.
const download = (filename: string, contents: Uint8Array): void => {
  const copy = new Uint8Array(contents.length);
  copy.set(contents);
  const url = URL.createObjectURL(new Blob([copy], { type: "application/octet-stream" }));
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
};

// EscrowExportDialog extracts a node's CA private key into an encrypted backup
// envelope. It is deliberately double-guarded: a >= 18-character passphrase
// (typed or generated) AND a typed confirmation (the node name or the word
// EXPORT) are both required before the button enables. On confirm it relays the
// backup through the manager and downloads the envelope; the passphrase is
// never rendered back or logged, and the envelope is downloaded, not displayed.
export const EscrowExportDialog = ({
  nodeName,
  onClose,
}: {
  nodeName: string;
  onClose: () => void;
}) => {
  const [passphrase, setPassphrase] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [done, setDone] = useState(false);

  const passphraseLongEnough = passphrase.length >= MIN_PASSPHRASE_LENGTH;
  const confirmed = confirmText === nodeName || confirmText === "EXPORT";
  const ready = passphraseLongEnough && confirmed && !pending;

  const confirm = () => {
    if (!ready) return;
    setPending(true);
    setError(null);
    exportCAKey(nodeName, passphrase)
      .then((envelope) => {
        download(`${nodeName}-ca-backup.enc`, envelope);
        // Clear the passphrase from state the moment it is no longer needed.
        setPassphrase("");
        setConfirmText("");
        setDone(true);
        setPending(false);
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Export failed");
        setPending(false);
      });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-labelledby="escrow-export-title"
        aria-modal="true"
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-bold" id="escrow-export-title">
            Export CA key
          </h2>
          <p className="font-mono text-xs text-muted-foreground">{nodeName}</p>
        </div>

        <div
          className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3"
          role="alert"
        >
          <p className="text-xs font-semibold text-destructive">
            This extracts the CA private key into an encrypted backup.
          </p>
          <p className="text-xs text-muted-foreground">
            Store the passphrase safely. Without it the backup is unrecoverable, and anyone with
            both the file and the passphrase can restore this CA elsewhere.
          </p>
        </div>

        {done ? (
          <p className="font-mono text-xs text-success" role="status">
            Encrypted backup downloaded.
          </p>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Passphrase (min {MIN_PASSPHRASE_LENGTH})
              </span>
              <input
                autoComplete="new-password"
                className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm"
                onChange={(e) => setPassphrase(e.target.value)}
                type="password"
                value={passphrase}
              />
            </label>
            <Button
              onClick={() => setPassphrase(generateStrongPassphrase())}
              size="sm"
              type="button"
              variant="outline"
            >
              Generate strong passphrase
            </Button>
            {passphrase.length > 0 && !passphraseLongEnough ? (
              <p className="font-mono text-xs text-destructive" role="alert">
                Passphrase must be at least {MIN_PASSPHRASE_LENGTH} characters.
              </p>
            ) : null}

            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Type {nodeName} or EXPORT to confirm
              </span>
              <input
                className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm"
                onChange={(e) => setConfirmText(e.target.value)}
                value={confirmText}
              />
            </label>

            {error ? (
              <p className="font-mono text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} size="sm" variant="outline">
            {done ? "Close" : "Cancel"}
          </Button>
          {done ? null : (
            <Button disabled={!ready} onClick={confirm} size="sm" variant="destructive">
              {pending ? "Exporting…" : "Export key"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
