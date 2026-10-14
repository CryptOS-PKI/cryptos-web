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

import { Button, Dialog, Field, Notice } from "@cryptos-pki/ui";
import { useState } from "react";

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
    <Dialog
      description={`${subjectCn} · ${serial}`}
      footer={
        <>
          <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
            Cancel
          </Button>
          <Button disabled={pending} onClick={confirm} size="sm" variant="destructive">
            {pending ? "Revoking…" : "Revoke"}
          </Button>
        </>
      }
      onClose={onClose}
      open
      title="Revoke certificate"
      variant="destructive"
    >
      <Field label="Reason">
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onChange={(e) => setReason(e.target.value as RevocationReason)}
          value={reason}
        >
          {reasons.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
    </Dialog>
  );
};
