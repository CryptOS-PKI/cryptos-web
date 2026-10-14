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

import { Button, Dialog, Field, Input } from "@cryptos-pki/ui";
import { useState } from "react";

import type { Node } from "@/lib/mock";

import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { validateNodeName } from "@/lib/fleet/node-name";
import { renameNode } from "@/lib/nodes";

// RenameNodeDialog renames a node's inventory entry (#87): its display name,
// which is what ListNodes, every /nodes/<name> URL and audit targetPath key
// on. It is the only place the console edits a node's name, and there is no
// equivalent anywhere for a certificate's subject CN -- that is signed
// material, so changing it is a re-issuance, not a rename, and the GUI does
// not offer to edit it. On success the caller is told the name that was
// actually stored, so it can move its own URL and any other name-keyed local
// state; every other view already re-renders from the fleet store once the
// rename lands there.
export const RenameNodeDialog = ({
  node,
  onClose,
  onRenamed,
}: {
  node: Node;
  onClose: () => void;
  onRenamed: (newName: string) => void;
}) => {
  const [name, setName] = useState(node.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const trimmed = name.trim();
  const validation = trimmed === node.name ? undefined : validateNodeName(trimmed);
  const ready = trimmed !== "" && !validation && !pending;

  const confirm = () => {
    if (!ready) return;
    setPending(true);
    setError(null);
    renameNode(node, trimmed)
      .then((finalName) => {
        onRenamed(finalName);
        onClose();
      })
      .catch((error_: unknown) => {
        setError(fleetErrorMessage(error_, "Rename failed."));
        setPending(false);
      });
  };

  return (
    <Dialog
      description={node.name}
      footer={
        <>
          <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
            Cancel
          </Button>
          <Button disabled={!ready} onClick={confirm} size="sm">
            {pending ? "Renaming…" : "Rename"}
          </Button>
        </>
      }
      onClose={onClose}
      open
      title="Rename node"
    >
      <Field error={validation ?? error} label="New name">
        <Input onChange={(e) => setName(e.target.value)} value={name} />
      </Field>
    </Dialog>
  );
};
