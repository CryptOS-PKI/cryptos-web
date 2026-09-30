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
import { type ApprovalRow, decideApproval } from "@/lib/approvals";

// ApprovalDecideDialog confirms an approve or deny. It repeats the summary and
// the full request digest so the operator can match them against what the
// agent reported before letting the action through.
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-labelledby="approval-decide-title"
        aria-modal="true"
        className="w-full max-w-lg space-y-4 rounded-xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-bold" id="approval-decide-title">
            {verb} request
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {target.tool} &middot; {target.requestedByCn} &middot; needs {target.requiredLevel}
          </p>
        </div>
        <p className="text-sm">{target.summary}</p>
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Request digest (SHA-256)
          </p>
          <p className="break-all rounded-md border bg-secondary/50 p-2 font-mono text-xs">
            {target.requestDigest}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {approve
            ? "The agent can run this exact request once. Check that the summary and digest match what the agent showed you."
            : "The agent's request is refused and cannot be retried with this approval."}
        </p>
        {error ? (
          <p className="font-mono text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
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
        </div>
      </div>
    </div>
  );
};
