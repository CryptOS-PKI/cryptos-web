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

import { readFileBytes } from "@/lib/download";
import { stageNodeImage } from "@/lib/node-image";

// StageNodeImageDialog installs a new CryptOS image on a managed node's
// spare ESP slot. The browser sends the manager a URL and the release
// signature only; the manager fetches the image itself, so a GiB-sized image
// never has to cross this dialog.
export const StageNodeImageDialog = ({
  nodeName,
  onClose,
  onDone,
}: {
  nodeName: string;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [imageUrl, setImageUrl] = useState("");
  const [signature, setSignature] = useState<null | Uint8Array>(null);
  const [sha256, setSha256] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const ready = imageUrl.trim() !== "" && signature !== null && !pending;

  const confirm = () => {
    if (!ready || !signature) return;
    setPending(true);
    setError(null);
    stageNodeImage(nodeName, { imageUrl: imageUrl.trim(), sha256: sha256.trim(), signature })
      .then(() => {
        onDone();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Staging failed");
        setPending(false);
      });
  };

  return (
    <Dialog
      description={nodeName}
      footer={
        <>
          <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
            Cancel
          </Button>
          <Button disabled={!ready} onClick={confirm} size="sm">
            {pending ? "Staging…" : "Stage"}
          </Button>
        </>
      }
      onClose={onClose}
      open
      title="Stage a CryptOS image"
    >
      <Field help="An http or https URL the manager fetches the image from." label="Image URL">
        <Input
          disabled={pending}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://images.example.org/cryptos-0.2.0.img"
          value={imageUrl}
        />
      </Field>

      <Field
        help="The detached release signature file over the whole image, from the CryptOS release key."
        label="Release signature"
      >
        <input
          accept=".sig,.bin"
          disabled={pending}
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen) void readFileBytes(chosen).then(setSignature);
          }}
          type="file"
        />
      </Field>
      {signature ? (
        <p className="font-mono text-[11px] text-muted-foreground">{signature.length} bytes</p>
      ) : null}

      <Field
        help="Optional; the node checks it against what it received."
        label="SHA-256 (optional)"
      >
        <Input
          disabled={pending}
          onChange={(e) => setSha256(e.target.value)}
          placeholder="deadbeef..."
          value={sha256}
        />
      </Field>

      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
    </Dialog>
  );
};
