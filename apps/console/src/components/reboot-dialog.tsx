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

import { Button } from "@/components/ui/button";
import { rebootNode } from "@/lib/reboot";

// RebootDialog triggers an orderly node reboot or power-off (#61), so a
// staged change (NodeSummary.reboot_required) can take effect without an
// out-of-band hypervisor reset. It follows the same in-UI confirmation as
// DecommissionDialog, never a window.confirm: the operator must type the
// node's CA CN exactly (shown for reference, echoed to the node which
// compares it constant-time) before the action enables. On confirm the
// manager dials the node over mTLS and invokes its admin-gated Reboot; errors
// (including a server-side permission denial) surface inline.
export const RebootDialog = ({
  caCn,
  nodeName,
  onClose,
  onDone,
  rebootRequired,
}: {
  caCn: string;
  nodeName: string;
  onClose: () => void;
  onDone: () => void;
  rebootRequired: boolean;
}) => {
  const [confirmCn, setConfirmCn] = useState("");
  const [powerOff, setPowerOff] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [done, setDone] = useState(false);

  const cnMatches = confirmCn === caCn;
  const ready = cnMatches && !pending;
  const actionLabel = powerOff ? "Power off" : "Reboot";
  const pendingLabel = powerOff ? "Powering off…" : "Rebooting…";

  const confirm = () => {
    if (!ready) return;
    setPending(true);
    setError(null);
    rebootNode(nodeName, confirmCn, powerOff)
      .then(() => {
        setDone(true);
        setPending(false);
        onDone();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Reboot failed");
        setPending(false);
      });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-labelledby="reboot-title"
        aria-modal="true"
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl"
        role="dialog"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-bold" id="reboot-title">
            Reboot node
          </h2>
          <p className="font-mono text-xs text-muted-foreground">{nodeName}</p>
        </div>

        <div
          className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3"
          role="alert"
        >
          {rebootRequired ? (
            <p className="text-xs font-semibold text-destructive">
              A reboot is needed for a staged change to take effect.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {powerOff
              ? "The node shuts down and stays off until the hypervisor or a person powers it back on."
              : "The node restarts in place."}{" "}
            Every certificate operation it serves is interrupted until it is back.
          </p>
        </div>

        {done ? (
          <p className="font-mono text-xs text-success" role="status">
            {nodeName} is {powerOff ? "powering off" : "rebooting"}.
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

            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Type the CA CN to confirm
              </span>
              <input
                className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm"
                onChange={(e) => setConfirmCn(e.target.value)}
                value={confirmCn}
              />
            </label>

            <label className="flex items-start gap-2 font-mono text-xs">
              <input
                checked={powerOff}
                className="mt-0.5"
                onChange={(e) => setPowerOff(e.target.checked)}
                type="checkbox"
              />
              <span>Power off instead of restarting.</span>
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
              {pending ? pendingLabel : actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
