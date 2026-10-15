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

import { Button, Dialog, Notice } from "@cryptos-pki/ui";
import { useState } from "react";

import { rollbackNodeImage } from "@/lib/node-image";

// RollbackNodeImageDialog puts a managed node's previously running image
// back on the boot path. ActivateNodeImage (or a reboot) is still needed to
// actually boot it, so this alone does not interrupt the node.
export const RollbackNodeImageDialog = ({
  nodeName,
  onClose,
  onDone,
}: {
  nodeName: string;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const confirm = () => {
    setPending(true);
    setError(null);
    rollbackNodeImage(nodeName)
      .then(() => {
        onDone();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Rollback failed");
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
          <Button disabled={pending} onClick={confirm} size="sm" variant="destructive">
            {pending ? "Rolling back…" : "Roll back"}
          </Button>
        </>
      }
      onClose={onClose}
      open
      title="Roll back image"
    >
      <Notice tone="warning">
        <p>
          The retained previous image replaces the active one. The node keeps running its current
          image until Activate (or a reboot) is run.
        </p>
      </Notice>
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
    </Dialog>
  );
};
