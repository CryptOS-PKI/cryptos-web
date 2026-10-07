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

import { Button } from "../components/button";
import { IconCopy } from "../icons";
import { buildUiIssueBundle, type UiIssueInput } from "./ui-issue";

// A development-only action, fixed above everything else, that copies a
// redacted schema v1 UI-issue bundle for pasting into a bug report. Both the
// build flag and the manager's meta tag have to be on for this to ever mount
// (see apps/console/src/dev/mount-ui-issue.tsx); this component itself has no
// opinion on that gate.
export const UiIssueCopy = ({ collect }: { collect: () => UiIssueInput }) => {
  const [state, setState] = useState<"copied" | "failed" | "idle">("idle");

  const copy = async () => {
    const bundle = buildUiIssueBundle(collect());
    try {
      await navigator.clipboard.writeText(bundle);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        aria-label="Copy for UI issue"
        data-testid="dev-ui-issue-copy"
        onClick={() => void copy()}
        size="icon"
        variant="dev"
      >
        <IconCopy />
      </Button>
      <span className="sr-only" role="status">
        {state === "copied" ? "Copied" : null}
        {state === "failed" ? "Copy failed" : null}
      </span>
    </div>
  );
};
