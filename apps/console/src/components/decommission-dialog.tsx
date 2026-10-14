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

import { decommissionNode } from "@/lib/decommission";

// DecommissionDialog runs a remote, destructive node wipe (S11). It is
// deliberately double-guarded, entirely in-UI (never a window.confirm): the
// operator must type the node's Root CA CN exactly (shown for reference, echoed
// to the node which compares it constant-time) AND tick an explicit
// destructive-acknowledgement before the button enables. On confirm the manager
// dials the node over mTLS and invokes its admin-gated RemoteReset; errors
// (including a server-side permission denial) surface inline.
export const DecommissionDialog = ({
  nodeName,
  onClose,
  onDone,
  rootCaCn,
}: {
  nodeName: string;
  onClose: () => void;
  onDone: () => void;
  rootCaCn: string;
}) => {
  const [confirmCn, setConfirmCn] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [done, setDone] = useState(false);

  const cnMatches = confirmCn === rootCaCn;
  const ready = cnMatches && acknowledged && !pending;

  const confirm = () => {
    if (!ready) return;
    setPending(true);
    setError(null);
    decommissionNode(nodeName, confirmCn)
      .then(() => {
        setDone(true);
        setPending(false);
        onDone();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Decommission failed");
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
              {pending ? "Decommissioning…" : "Decommission"}
            </Button>
          )}
        </>
      }
      onClose={onClose}
      open
      title="Decommission node"
      variant="destructive"
    >
      <Notice tone="danger">
        <p className="font-semibold">
          This permanently destroys the node&apos;s identity and data.
        </p>
        <p>
          The node wipes its key material and state, then reboots into maintenance. This cannot be
          undone.
        </p>
      </Notice>

      {done ? (
        <p className="font-mono text-xs text-success" role="status">
          {nodeName} is wiping and entering maintenance.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Root CA CN (for reference)
            </p>
            <p className="break-all rounded-md border bg-secondary px-3 py-2 font-mono text-xs">
              {rootCaCn}
            </p>
          </div>

          <TypeToConfirm
            expected={rootCaCn}
            label="Type the Root CA CN to confirm"
            onChange={setConfirmCn}
            value={confirmCn}
          />

          <label className="flex items-start gap-2 font-mono text-xs">
            <input
              checked={acknowledged}
              className="mt-0.5"
              onChange={(e) => setAcknowledged(e.target.checked)}
              type="checkbox"
            />
            <span>I understand this permanently destroys the node&apos;s identity and data.</span>
          </label>

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
