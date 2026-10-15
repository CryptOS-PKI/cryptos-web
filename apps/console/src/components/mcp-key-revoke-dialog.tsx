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

import { revokeMcpKey } from "@/lib/mcp-keys";

// McpKeyRevokeDialog confirms an agent key revocation. The manager refuses the
// key on its next request, so an agent using it loses access immediately.
export const McpKeyRevokeDialog = ({
  onClose,
  onRevoked,
  target,
}: {
  onClose: () => void;
  onRevoked: () => void;
  target: { id: string; label: string; operatorCn: string };
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const confirm = () => {
    setPending(true);
    setError(null);
    revokeMcpKey(target.id)
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
    <Dialog
      description={`${target.label || target.id} · ${target.operatorCn}`}
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
      title="Revoke agent key"
      variant="destructive"
    >
      <p className="text-sm text-muted-foreground">
        Any agent using this key loses access on its next request. This cannot be undone; the agent
        has to sign in again for a new key.
      </p>
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
    </Dialog>
  );
};
