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

import { Button, Notice, Stepper } from "@cryptos-pki/ui";
import { useState } from "react";

import type { Node } from "@/lib/mock";

import { useAuth } from "@/context/auth";
import { fleetMode } from "@/lib/fleet/mode";
import { DEFAULT_REKEY_PROFILE, rekeyNode, type RekeyResult } from "@/lib/rekey";

// MockRekeyDemo keeps the pre-live stepped walkthrough for `mock` mode: it
// drives no RPC, just advances a local step counter so the fixture UI still
// demonstrates the ceremony shape.
const MockRekeyDemo = ({ node }: { node: Node }) => {
  const isRoot = node.role === "root";
  const labels = isRoot
    ? ["Generate new key", "Self-sign new certificate", "Install new identity"]
    : ["Generate new key", "Generate CSR", "Parent signs", "Install new identity"];
  const steps = labels.map((label) => ({ id: label, label }));
  const [current, setCurrent] = useState(0);
  const done = current >= steps.length;

  return (
    <div className="max-w-md space-y-4">
      <Stepper current={current} label={`Re-key ${node.name}`} steps={steps} />

      {done ? (
        <Notice tone="success">Re-key complete for {node.name}.</Notice>
      ) : (
        <Button onClick={() => setCurrent((c) => c + 1)} type="button">
          {labels[current]}
        </Button>
      )}
    </div>
  );
};

// LiveRekey drives the whole re-key through the manager's single orchestrated
// RekeyNode RPC: one click runs the ferry manager-side (child mints a new key +
// CSR, the parent signs it, the child adopts the new chain) and the result
// reports the re-keyed identity. An RPC failure surfaces inline (no native
// popup) and does not advance to the done state, so the operator can retry.
const LiveRekey = ({ node }: { node: Node }) => {
  const { operator } = useAuth();
  const canSubmit = operator ? operator.level !== "viewer" : false;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<null | RekeyResult>(null);

  const submit = async () => {
    setPending(true);
    setError("");
    try {
      setResult(await rekeyNode(node.name, DEFAULT_REKEY_PROFILE));
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "Re-key failed");
    } finally {
      setPending(false);
    }
  };

  // A self-signed root is its own issuer, so there is no parent to sign a
  // rotation CSR; the manager refuses it. Don't offer the action for roots.
  if (node.role === "root") {
    return (
      <p className="max-w-md font-mono text-sm text-muted-foreground">
        {node.name} is a root CA. Re-keying through the manager is only for subordinate CAs — a root
        has no parent to sign its new key.
      </p>
    );
  }

  if (result) {
    return (
      <Notice className="max-w-md" tone="success">
        <p>Re-key complete for {node.name}.</p>
        <p className="text-muted-foreground">
          subject <span className="text-foreground">{result.subjectCn}</span>
        </p>
        <p className="text-muted-foreground">
          issued by <span className="text-foreground">{result.issuerCn}</span>
        </p>
        <p className="text-muted-foreground">
          chain length <span className="text-foreground">{result.chainLen}</span>
        </p>
      </Notice>
    );
  }

  return (
    <div className="max-w-md space-y-3">
      <p className="font-mono text-sm text-muted-foreground">
        Re-keying mints a new key on {node.name}, has its parent sign the new CSR, and installs the
        new chain in one step.
      </p>
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
      <Button
        disabled={canSubmit && pending}
        lockedReason={canSubmit ? undefined : "Needs the operator role"}
        onClick={() => void submit()}
        type="button"
      >
        {pending ? "Re-keying…" : `Re-key ${node.name}`}
      </Button>
    </div>
  );
};

export const RekeyWizard = ({ node }: { node: Node }) =>
  fleetMode() === "mock" ? <MockRekeyDemo node={node} /> : <LiveRekey node={node} />;
