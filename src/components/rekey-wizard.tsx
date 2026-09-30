/*
Apache License 2.0

Copyright 2026 Shane

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
import { fleetMode } from "@/lib/fleet/mode";
import { type Node } from "@/lib/mock";
import { DEFAULT_REKEY_PROFILE, rekeyNode, type RekeyResult } from "@/lib/rekey";
import { cn } from "@/lib/utils";

const stepClass = (i: number, current: number): string => {
  if (i < current) return "text-success";
  if (i === current) return "text-foreground";
  return "text-muted-foreground";
};

// MockRekeyDemo keeps the pre-live stepped walkthrough for `mock` mode: it
// drives no RPC, just advances a local step counter so the fixture UI still
// demonstrates the ceremony shape.
const MockRekeyDemo = ({ node }: { node: Node }) => {
  const isRoot = node.role === "root";
  const steps = isRoot
    ? ["Generate new key", "Self-sign new certificate", "Install new identity"]
    : ["Generate new key", "Generate CSR", "Parent signs", "Install new identity"];
  const [current, setCurrent] = useState(0);
  const done = current >= steps.length;

  return (
    <div className="max-w-md space-y-4">
      <ol className="space-y-2">
        {steps.map((label, i) => (
          <li
            className={cn("flex items-center gap-2 font-mono text-sm", stepClass(i, current))}
            key={label}
          >
            <span className="inline-flex size-5 items-center justify-center rounded-full border text-[11px]">
              {i < current ? "\u2713" : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {done ? (
        <p className="font-mono text-sm text-success">Re-key complete for {node.name}.</p>
      ) : (
        <Button onClick={() => setCurrent((c) => c + 1)} type="button">
          {steps[current]}
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
      <div className="max-w-md space-y-1 rounded-md border bg-secondary p-3">
        <p className="font-mono text-sm text-success">Re-key complete for {node.name}.</p>
        <p className="font-mono text-xs text-muted-foreground">
          subject <span className="text-foreground">{result.subjectCn}</span>
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          issued by <span className="text-foreground">{result.issuerCn}</span>
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          chain length <span className="text-foreground">{result.chainLen}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-3">
      <p className="font-mono text-sm text-muted-foreground">
        Re-keying mints a new key on {node.name}, has its parent sign the new CSR, and installs the
        new chain in one step.
      </p>
      {error ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} onClick={() => void submit()} type="button">
        {pending ? "Re-keying…" : `Re-key ${node.name}`}
      </Button>
    </div>
  );
};

export const RekeyWizard = ({ node }: { node: Node }) =>
  fleetMode() === "mock" ? <MockRekeyDemo node={node} /> : <LiveRekey node={node} />;
