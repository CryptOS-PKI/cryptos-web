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

import {
  Button,
  Dialog,
  Field,
  Input,
  inputClasses,
  Notice,
  ShownOnceSecret,
} from "@cryptos-pki/ui";
import { useState } from "react";

import type { OperatorLevel } from "@/context/auth";

import { ceilingsUpTo, createMcpKey } from "@/lib/mcp-keys";

// McpKeyCreateDialog mints an agent key for an MCP client that cannot run the
// browser sign-in. The plaintext lives only in this dialog's state: the page is
// told a key was made, never what it is, and closing the dialog discards it.
export const McpKeyCreateDialog = ({
  level,
  onClose,
  onCreated,
}: {
  level: OperatorLevel;
  onClose: () => void;
  onCreated: () => void;
}) => {
  const ceilings = ceilingsUpTo(level);
  const [label, setLabel] = useState("");
  const [ceiling, setCeiling] = useState<OperatorLevel>(level);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [plaintext, setPlaintext] = useState("");

  const close = () => {
    setPlaintext("");
    onClose();
  };

  const create = () => {
    setPending(true);
    setError(null);
    createMcpKey({ label: label.trim(), levelCeiling: ceiling })
      .then(({ plaintextKey }) => {
        setPlaintext(plaintextKey);
        setPending(false);
        onCreated();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Create failed");
        setPending(false);
      });
  };

  return (
    <Dialog
      description="For an MCP client that cannot open the browser sign-in"
      footer={
        plaintext ? undefined : (
          <>
            <Button disabled={pending} onClick={close} size="sm" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} onClick={create} size="sm">
              {pending ? "Creating…" : "Create key"}
            </Button>
          </>
        )
      }
      onClose={onClose}
      open
      title="Create agent key"
    >
      <p className="text-xs text-muted-foreground">
        The key acts as you, up to its ceiling, until it is revoked or your certificate is revoked
        or renewed.
      </p>
      <p className="text-xs text-muted-foreground">
        MCP needs a current CRL from your certificate&apos;s operator CA. Under a CA with no CRL
        source, or a CRL past its next update, the key is refused (error 1608).
      </p>

      {plaintext ? (
        <ShownOnceSecret
          label="Agent key"
          onDone={close}
          secret={plaintext}
          warning="Copy this key into your MCP client now. It will not be shown again, and the manager keeps only a hash of it."
        />
      ) : (
        <>
          <Field label="Label">
            <Input
              disabled={pending}
              maxLength={120}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. build agent"
              value={label}
            />
          </Field>
          <Field label="Level ceiling">
            <select
              className={inputClasses}
              disabled={pending}
              onChange={(e) => setCeiling(e.target.value as OperatorLevel)}
              value={ceiling}
            >
              {ceilings.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
