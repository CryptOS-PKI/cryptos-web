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

import { Button, Dialog, Field, inputClasses, Notice } from "@cryptos-pki/ui";
import { useState } from "react";

import { fleetErrorMessage } from "@/lib/fleet/error-copy";
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
    <Dialog
      description={`${credential.commonName} · ${credential.serialHex}`}
      footer={
        warnings ? (
          <Button onClick={onClose} size="sm">
            Close
          </Button>
        ) : (
          <>
            <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} onClick={confirm} size="sm" variant="destructive">
              {pending ? "Denying…" : "Deny at the Fleet Manager"}
            </Button>
          </>
        )
      }
      onClose={onClose}
      open
      title="Deny at the Fleet Manager"
    >
      {warnings ? (
        <Notice role="status" tone="warning">
          <p className="font-semibold">Denied at the Fleet Manager.</p>
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </Notice>
      ) : (
        <>
          <Notice role="note" tone="warning">
            The Fleet Manager refuses this credential from its next request. It does not revoke at
            your CA: other systems that trust the CA still accept it. Also revoke it at your CA and
            publish a new CRL.
          </Notice>
          <Field label="Reason">
            <select
              className={inputClasses}
              onChange={(e) => setReasonCode(Number(e.target.value))}
              value={reasonCode}
            >
              {DENY_REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label} ({r.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Note (kept with the denylist entry)">
            <textarea
              className={`${inputClasses} h-16`}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              value={note}
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
