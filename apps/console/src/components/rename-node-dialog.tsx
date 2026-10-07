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

import { Button } from "@/components/ui/button";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { validateNodeName } from "@/lib/fleet/node-name";
import { type Node } from "@/lib/mock";
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-labelledby="rename-node-title"
        aria-modal="true"
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl"
        role="dialog"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-bold" id="rename-node-title">
            Rename node
          </h2>
          <p className="font-mono text-xs text-muted-foreground">{node.name}</p>
        </div>

        <label className="block space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            New name
          </span>
          <input
            className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm"
            onChange={(e) => setName(e.target.value)}
            value={name}
          />
        </label>

        {validation ? (
          <p className="font-mono text-xs text-destructive" role="alert">
            {validation}
          </p>
        ) : null}
        {error ? (
          <p className="font-mono text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
            Cancel
          </Button>
          <Button disabled={!ready} onClick={confirm} size="sm">
            {pending ? "Renaming…" : "Rename"}
          </Button>
        </div>
      </div>
    </div>
  );
};
