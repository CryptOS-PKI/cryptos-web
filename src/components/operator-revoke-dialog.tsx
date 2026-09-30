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
import { revokeOperatorCredential } from "@/lib/operators";

// RFC 5280 CRL reason codes offered for an operator-credential revocation.
const reasons: { code: number; label: string }[] = [
  { code: 1, label: "keyCompromise" },
  { code: 5, label: "cessationOfOperation" },
  { code: 4, label: "superseded" },
  { code: 3, label: "affiliationChanged" },
  { code: 0, label: "unspecified" },
];

// OperatorRevokeDialog revokes an operator credential by serial with a reason.
// Once revoked, the manager's authz middleware denies that serial (the
// revocation is enforced server-side); this dialog is the operator-facing
// trigger. Errors surface inline; there is no native popup.
export const OperatorRevokeDialog = ({
  commonName,
  onClose,
  onRevoked,
  serialHex,
}: {
  commonName: string;
  onClose: () => void;
  onRevoked: () => void;
  serialHex: string;
}) => {
  const [reasonCode, setReasonCode] = useState(reasons[0].code);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const confirm = () => {
    setPending(true);
    setError(null);
    revokeOperatorCredential(serialHex, reasonCode)
      .then(() => {
        onRevoked();
        onClose();
      })
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
        aria-labelledby="operator-revoke-title"
        aria-modal="true"
        className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-bold" id="operator-revoke-title">
            Revoke operator credential
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {commonName} &middot; {serialHex}
          </p>
        </div>
        <label className="block space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Reason
          </span>
          <select
            className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm"
            onChange={(e) => setReasonCode(Number(e.target.value))}
            value={reasonCode}
          >
            {reasons.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
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
