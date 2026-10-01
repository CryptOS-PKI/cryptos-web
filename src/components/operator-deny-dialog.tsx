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

import { DialogFrame } from "@/components/dialog-frame";
import { Button } from "@/components/ui/button";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { fieldClass, labelClass } from "@/lib/form";
import {
  CA_REVOKE_REMINDER,
  DENY_REASONS,
  denyOperatorCredential,
  type OperatorCredentialRow,
} from "@/lib/operators";

// OperatorDenyDialog puts an operator credential on the Fleet Manager
// denylist. The authz middleware refuses it from its next request, on every
// replica within seconds. It doesn't revoke at the external CA, so the dialog
// says so before and after, including the manager's own warnings.
export const OperatorDenyDialog = ({
  credential,
  onClose,
  onDenied,
}: {
  credential: OperatorCredentialRow;
  onClose: () => void;
  onDenied: () => void;
}) => {
  const [reasonCode, setReasonCode] = useState(DENY_REASONS[0].code);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [warnings, setWarnings] = useState<null | string[]>(null);

  const confirm = () => {
    setPending(true);
    setError(null);
    denyOperatorCredential({
      issuerSha256: credential.issuerSha256,
      note: note.trim(),
      reasonCode,
      serialHex: credential.serialHex,
    })
      .then((result) => {
        setWarnings(result.warnings.length > 0 ? result.warnings : [CA_REVOKE_REMINDER]);
        onDenied();
      })
      .catch((error_: unknown) => {
        setError(fleetErrorMessage(error_, "Deny failed."));
      })
      .finally(() => setPending(false));
  };

  return (
    <DialogFrame labelId="operator-deny-title" onClose={onClose}>
      <div className="space-y-1">
        <h2 className="text-lg font-bold" id="operator-deny-title">
          Deny at the Fleet Manager
        </h2>
        <p className="font-mono text-xs text-muted-foreground">
          {credential.commonName} &middot; {credential.serialHex}
        </p>
      </div>

      {warnings ? (
        <>
          <div
            className="space-y-1 rounded-md border border-warning/40 bg-warning/10 p-3"
            role="status"
          >
            <p className="text-xs font-semibold text-foreground">Denied at the Fleet Manager.</p>
            {warnings.map((w) => (
              <p className="text-xs text-muted-foreground" key={w}>
                {w}
              </p>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose} size="sm">
              Close
            </Button>
          </div>
        </>
      ) : (
        <>
          <p
            className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-muted-foreground"
            role="note"
          >
            The Fleet Manager refuses this credential from its next request. It does not revoke at
            your CA: other systems that trust the CA still accept it. Also revoke it at your CA and
            publish a new CRL.
          </p>
          <label className="block space-y-1">
            <span className={labelClass}>Reason</span>
            <select
              className={fieldClass}
              onChange={(e) => setReasonCode(Number(e.target.value))}
              value={reasonCode}
            >
              {DENY_REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label} ({r.code})
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className={labelClass}>Note (kept with the denylist entry)</span>
            <textarea
              className={`${fieldClass} h-16`}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              value={note}
            />
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
              {pending ? "Denying…" : "Deny at the Fleet Manager"}
            </Button>
          </div>
        </>
      )}
    </DialogFrame>
  );
};
