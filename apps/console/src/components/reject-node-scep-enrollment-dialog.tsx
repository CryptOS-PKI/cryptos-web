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

import { rejectNodeScepEnrollment } from "@/lib/node-scep-enrollments";

// RejectNodeScepEnrollmentDialog rejects a pending SCEP enrolment on a
// managed node. The reason is recorded in the node's own audit log; RFC 8894
// answers the device only with a failInfo code, never the reason text.
export const RejectNodeScepEnrollmentDialog = ({
  enrollmentId,
  nodeName,
  onClose,
  onDone,
  subjectDn,
}: {
  enrollmentId: string;
  nodeName: string;
  onClose: () => void;
  onDone: () => void;
  subjectDn: string;
}) => {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const confirm = () => {
    setPending(true);
    setError(null);
    rejectNodeScepEnrollment(nodeName, enrollmentId, reason.trim())
      .then(() => {
        onDone();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Reject failed");
        setPending(false);
      });
  };

  return (
    <Dialog
      description={subjectDn}
      footer={
        <>
          <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
            Cancel
          </Button>
          <Button disabled={pending} onClick={confirm} size="sm" variant="destructive">
            {pending ? "Rejecting…" : "Reject"}
          </Button>
        </>
      }
      onClose={onClose}
      open
      title="Reject SCEP enrolment"
      variant="destructive"
    >
      <Field
        help="Recorded in the node's own audit log. Not sent to the device."
        label="Reason (optional)"
      >
        <textarea
          className={`${inputClasses} h-20 text-[13px]`}
          disabled={pending}
          onChange={(e) => setReason(e.target.value)}
          value={reason}
        />
      </Field>
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
    </Dialog>
  );
};
