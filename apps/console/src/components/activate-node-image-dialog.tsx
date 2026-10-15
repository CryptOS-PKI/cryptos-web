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

import { Button, Dialog, Notice, TypeToConfirm } from "@cryptos-pki/ui";
import { useState } from "react";

import { activateNodeImage } from "@/lib/node-image";

// ActivateNodeImageDialog reboots a managed node so a staged image starts
// running. It follows the same in-UI confirmation as RebootDialog, never a
// window.confirm: the operator must type the node's CA CN exactly (shown for
// reference, echoed to the node which compares it constant-time) before the
// action enables, because activating is itself a reboot.
export const ActivateNodeImageDialog = ({
  caCn,
  nodeName,
  onClose,
  onDone,
}: {
  caCn: string;
  nodeName: string;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [confirmCn, setConfirmCn] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [done, setDone] = useState(false);

  const ready = confirmCn === caCn && !pending;

  const confirm = () => {
    if (!ready) return;
    setPending(true);
    setError(null);
    activateNodeImage(nodeName, confirmCn)
      .then(() => {
        setDone(true);
        setPending(false);
        onDone();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Activation failed");
        setPending(false);
      });
  };

  return (
    <Dialog
      description={nodeName}
      footer={
        <>
          <Button onClick={onClose} size="sm" variant="outline">
            {done ? "Close" : "Cancel"}
          </Button>
          {done ? null : (
            <Button disabled={!ready} onClick={confirm} size="sm" variant="destructive">
              {pending ? "Activating…" : "Activate"}
            </Button>
          )}
        </>
      }
      onClose={onClose}
      open
      title="Activate staged image"
      variant="destructive"
    >
      <Notice tone="danger">
        <p>
          The node reboots onto the staged image. Every certificate operation it serves is
          interrupted until it is back.
        </p>
      </Notice>

      {done ? (
        <p className="font-mono text-xs text-success" role="status">
          {nodeName} is activating the staged image.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              CA CN (for reference)
            </p>
            <p className="break-all rounded-md border bg-secondary px-3 py-2 font-mono text-xs">
              {caCn}
            </p>
          </div>

          <TypeToConfirm
            expected={caCn}
            label="Type the CA CN to confirm"
            onChange={setConfirmCn}
            value={confirmCn}
          />

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
