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
import { type RevocationReason, revokeCert } from "@/lib/certs";

const reasons: RevocationReason[] = [
  "keyCompromise",
  "cessationOfOperation",
  "superseded",
  "affiliationChanged",
  "unspecified",
];

export const RevokeDialog = ({
  onClose,
  serial,
  subjectCn,
}: {
  onClose: () => void;
  serial: string;
  subjectCn: string;
}) => {
  const [reason, setReason] = useState<RevocationReason>("keyCompromise");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const confirm = () => {
    setPending(true);
    setError(null);
    revokeCert(serial, reason)
      .then(onClose)
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Revoke failed");
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
        aria-labelledby="revoke-dialog-title"
        aria-modal="true"
        className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-bold" id="revoke-dialog-title">
            Revoke certificate
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {subjectCn} &middot; {serial}
          </p>
        </div>
        <label className="block space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Reason
          </span>
          <select
            className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm"
            onChange={(e) => setReason(e.target.value as RevocationReason)}
            value={reason}
          >
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r}
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
          <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
            Cancel
          </Button>
          <Button disabled={pending} onClick={confirm} size="sm" variant="destructive">
            {pending ? "Revoking…" : "Revoke"}
          </Button>
        </div>
      </div>
    </div>
  );
};
