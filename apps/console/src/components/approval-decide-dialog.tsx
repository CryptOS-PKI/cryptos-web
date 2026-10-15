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

import { type ApprovalRow, decideApproval } from "@/lib/approvals";

// ApprovalDecideDialog confirms an approve or deny. It repeats the approval ID
// and summary, which the manager's pending_approval response also gives the
// agent, so the operator can match them against what the agent showed before
// letting the action through. The request digest is shown as a detail only: the
// agent never receives it, and the audit log records it with the decision.
export const ApprovalDecideDialog = ({
  approve,
  onClose,
  onDecided,
  target,
}: {
  approve: boolean;
  onClose: () => void;
  onDecided: () => void;
  target: Pick<
    ApprovalRow,
    "id" | "requestDigest" | "requestedByCn" | "requiredLevel" | "summary" | "tool"
  >;
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const verb = approve ? "Approve" : "Deny";

  const confirm = () => {
    setPending(true);
    setError(null);
    decideApproval({ approve, id: target.id })
      .then(() => {
        onDecided();
        onClose();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : `${verb} failed`);
        setPending(false);
      });
  };

  return (
    <Dialog
      description={`${target.tool} · ${target.requestedByCn} · needs ${target.requiredLevel}`}
      footer={
        <>
          <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={confirm}
            size="sm"
            variant={approve ? "default" : "destructive"}
          >
            {pending ? (approve ? "Approving…" : "Denying…") : verb}
          </Button>
        </>
      }
      onClose={onClose}
      open
      title={`${verb} request`}
    >
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Approval ID
        </p>
        <p className="break-all font-mono text-sm">{target.id}</p>
      </div>
      <p className="text-sm">{target.summary}</p>
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Request digest (SHA-256)
        </p>
        <p className="break-all rounded-md border bg-secondary/50 p-2 font-mono text-xs">
          {target.requestDigest}
        </p>
        <p className="text-xs text-muted-foreground">
          Recorded in the audit log with the decision and the agent&apos;s call.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {approve
          ? "The agent can run this exact request once. Check that the approval ID and summary match what the agent showed you."
          : "The agent's request is refused and cannot be retried with this approval."}
      </p>
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
    </Dialog>
  );
};
