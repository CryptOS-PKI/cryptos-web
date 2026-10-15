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

import { Button, Dialog, FieldTile, FieldTiles, Notice } from "@cryptos-pki/ui";
import { useState } from "react";

import { approveNodeScepEnrollment } from "@/lib/node-scep-enrollments";

// ApproveNodeScepEnrollmentDialog approves a pending SCEP enrolment on a
// managed node, issuing the device a certificate under the request's
// profile. The issued serial is shown so the operator can find it again in
// the certificate inventory.
export const ApproveNodeScepEnrollmentDialog = ({
  enrollmentId,
  nodeName,
  onClose,
  onDone,
  profile,
  subjectDn,
}: {
  enrollmentId: string;
  nodeName: string;
  onClose: () => void;
  onDone: () => void;
  profile: string;
  subjectDn: string;
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [serialHex, setSerialHex] = useState("");

  const confirm = () => {
    setPending(true);
    setError(null);
    approveNodeScepEnrollment(nodeName, enrollmentId)
      .then((serial) => {
        setSerialHex(serial);
        setPending(false);
        onDone();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Approve failed");
        setPending(false);
      });
  };

  return (
    <Dialog
      description={subjectDn}
      footer={
        <>
          <Button onClick={onClose} size="sm" variant="outline">
            {serialHex ? "Close" : "Cancel"}
          </Button>
          {serialHex ? null : (
            <Button disabled={pending} onClick={confirm} size="sm">
              {pending ? "Approving…" : "Approve"}
            </Button>
          )}
        </>
      }
      onClose={onClose}
      open
      title="Approve SCEP enrolment"
    >
      {serialHex ? (
        <FieldTiles columns={1}>
          <FieldTile label="Issued serial" mono value={serialHex} />
        </FieldTiles>
      ) : (
        <>
          <Notice tone="info">
            <p>The device gets a certificate under the {profile} profile.</p>
          </Notice>
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
