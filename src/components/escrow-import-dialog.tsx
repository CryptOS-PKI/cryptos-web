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
import { importCAKey, MIN_PASSPHRASE_LENGTH, type RestoredIdentity } from "@/lib/escrow";

// EscrowImportDialog restores a CA identity onto a fresh node from an uploaded
// encrypted backup envelope. It requires both a chosen file and a >= 18
// character passphrase before enabling. A node that already holds an identity
// refuses the import; that error surfaces inline (no native popup). The
// passphrase is never rendered back.
export const EscrowImportDialog = ({
  nodeName,
  onClose,
}: {
  nodeName: string;
  onClose: () => void;
}) => {
  const [envelope, setEnvelope] = useState<null | Uint8Array>(null);
  const [fileName, setFileName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [restored, setRestored] = useState<null | RestoredIdentity>(null);

  const passphraseLongEnough = passphrase.length >= MIN_PASSPHRASE_LENGTH;
  const ready = envelope !== null && envelope.length > 0 && passphraseLongEnough && !pending;

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setEnvelope(null);
      setFileName("");
      return;
    }
    setFileName(file.name);
    file
      .arrayBuffer()
      .then((buffer) => setEnvelope(new Uint8Array(buffer)))
      .catch(() => setError("Could not read the selected file."));
  };

  const confirm = () => {
    if (!ready || envelope === null) return;
    setPending(true);
    setError(null);
    importCAKey(nodeName, envelope, passphrase)
      .then((identity) => {
        setPassphrase("");
        setRestored(identity);
        setPending(false);
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Import failed");
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
        aria-labelledby="escrow-import-title"
        aria-modal="true"
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-bold" id="escrow-import-title">
            Import CA key
          </h2>
          <p className="font-mono text-xs text-muted-foreground">{nodeName}</p>
        </div>

        <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs text-muted-foreground">
          Restore a CA identity from an encrypted backup. Import only onto a fresh node with no
          existing CA identity.
        </p>

        {restored ? (
          <div className="space-y-1" role="status">
            <p className="font-mono text-xs text-success">Restored CA identity.</p>
            <p className="font-mono text-xs text-muted-foreground">subject: {restored.subjectCn}</p>
            <p className="font-mono text-xs text-muted-foreground">issuer: {restored.issuerCn}</p>
          </div>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Backup envelope file
              </span>
              <input
                accept=".enc,application/octet-stream"
                aria-label="Backup envelope file"
                className="w-full rounded-md border bg-card px-3 py-2 font-mono text-xs"
                onChange={onFile}
                type="file"
              />
              {fileName ? (
                <span className="font-mono text-[11px] text-muted-foreground">{fileName}</span>
              ) : null}
            </label>

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
            {passphrase.length > 0 && !passphraseLongEnough ? (
              <p className="font-mono text-xs text-destructive" role="alert">
                Passphrase must be at least {MIN_PASSPHRASE_LENGTH} characters.
              </p>
            ) : null}

            {error ? (
              <p className="font-mono text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} size="sm" variant="outline">
            {restored ? "Close" : "Cancel"}
          </Button>
          {restored ? null : (
            <Button disabled={!ready} onClick={confirm} size="sm">
              {pending ? "Importing…" : "Import key"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
