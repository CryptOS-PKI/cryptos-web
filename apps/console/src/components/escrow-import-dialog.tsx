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

import { Button, Dialog, Field, Input, Notice } from "@cryptos-pki/ui";
import { useState } from "react";

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
    <Dialog
      description={nodeName}
      footer={
        <>
          <Button onClick={onClose} size="sm" variant="outline">
            {restored ? "Close" : "Cancel"}
          </Button>
          {restored ? null : (
            <Button disabled={!ready} onClick={confirm} size="sm">
              {pending ? "Importing…" : "Import key"}
            </Button>
          )}
        </>
      }
      onClose={onClose}
      open
      title="Import CA key"
    >
      <Notice tone="info">
        Restore a CA identity from an encrypted backup. Import only onto a fresh node with no
        existing CA identity.
      </Notice>

      {restored ? (
        <div className="space-y-1" role="status">
          <p className="font-mono text-xs text-success">Restored CA identity.</p>
          <p className="font-mono text-xs text-muted-foreground">subject: {restored.subjectCn}</p>
          <p className="font-mono text-xs text-muted-foreground">issuer: {restored.issuerCn}</p>
        </div>
      ) : (
        <>
          <Field label="Backup envelope file">
            <Input
              accept=".enc,application/octet-stream"
              mono={false}
              onChange={onFile}
              type="file"
            />
          </Field>
          {fileName ? (
            <span className="font-mono text-[11px] text-muted-foreground">{fileName}</span>
          ) : null}

          <Field
            error={
              passphrase.length > 0 && !passphraseLongEnough
                ? `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`
                : undefined
            }
            label={`Passphrase (min ${MIN_PASSPHRASE_LENGTH})`}
          >
            <Input
              autoComplete="new-password"
              onChange={(e) => setPassphrase(e.target.value)}
              type="password"
              value={passphrase}
            />
          </Field>

          {error ? (
            <Notice role="alert" tone="danger">
              {error}
            </Notice>
          ) : null}
        </>
      )}
    </Dialog>
  );
};
