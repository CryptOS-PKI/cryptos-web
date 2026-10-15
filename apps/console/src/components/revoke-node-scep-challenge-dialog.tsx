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

import { Button, Dialog, Notice } from "@cryptos-pki/ui";
import { useState } from "react";

import { revokeNodeScepChallenge } from "@/lib/node-scep-challenges";

// RevokeNodeScepChallengeDialog withdraws a managed node's SCEP challenge
// before it is used or expires. A device that already has the challenge
// password cannot enroll with it once revoked.
export const RevokeNodeScepChallengeDialog = ({
  challengeId,
  nodeName,
  onClose,
  onDone,
  profile,
}: {
  challengeId: string;
  nodeName: string;
  onClose: () => void;
  onDone: () => void;
  profile: string;
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const confirm = () => {
    setPending(true);
    setError(null);
    revokeNodeScepChallenge(nodeName, challengeId)
      .then(() => {
        onDone();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Revoke failed");
        setPending(false);
      });
  };

  return (
    <Dialog
      description={`${challengeId} · ${profile}`}
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
      title="Revoke SCEP challenge"
      variant="destructive"
    >
      <Notice tone="warning">
        <p>A device that already has this challenge password can no longer enroll with it.</p>
      </Notice>
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
    </Dialog>
  );
};
