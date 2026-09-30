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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-labelledby="decommission-title"
        aria-modal="true"
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-bold" id="decommission-title">
            Decommission node
          </h2>
          <p className="font-mono text-xs text-muted-foreground">{nodeName}</p>
        </div>

        <div
          className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3"
          role="alert"
        >
          <p className="text-xs font-semibold text-destructive">
            This permanently destroys the node&apos;s identity and data.
          </p>
          <p className="text-xs text-muted-foreground">
            The node wipes its key material and state, then reboots into maintenance. This cannot be
            undone.
          </p>
        </div>

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

            <label className="block space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Type the Root CA CN to confirm
              </span>
              <input
                className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm"
                onChange={(e) => setConfirmCn(e.target.value)}
                value={confirmCn}
              />
            </label>

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
              {pending ? "Decommissioning…" : "Decommission"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
