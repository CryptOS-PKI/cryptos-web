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
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useOptionalAuth } from "@/context/auth";
import { buildReport, fetchBuildInfo } from "@/lib/diagnostics";
import { fleetMode } from "@/lib/fleet/mode";

// The copy action for an alpha report (#83).
//
// It uses useOptionalAuth rather than useAuth so it can render on the landing
// page and the denial screens, where there is no operator yet. Those are the
// reports worth having most -- someone who cannot get in -- and a diagnostics
// block that needed a session would be missing exactly there.

export const DiagnosticsCopy = ({ className }: { className?: string }) => {
  const auth = useOptionalAuth();
  const { pathname, search } = useLocation();
  const [state, setState] = useState<"copied" | "failed" | "idle">("idle");
  const [report, setReport] = useState("");

  const run = async () => {
    const text = buildReport({
      build: await fetchBuildInfo(),
      fleetMode: fleetMode(),
      operator: auth?.operator ?? null,
      reason: auth?.reason ?? null,
      route: `${pathname}${search}`,
      status: auth?.status ?? "anonymous",
      userAgent: globalThis.navigator?.userAgent ?? "unknown",
    });
    setReport(text);

    try {
      await globalThis.navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      // The clipboard API needs a secure context and a granted permission, and
      // an operator on a self-signed bootstrap certificate may have neither.
      // Show the text instead of losing the report.
      setState("failed");
    }
  };

  return (
    <div className={className}>
      <Button onClick={() => void run()} size="sm" type="button" variant="outline">
        {state === "copied" ? "Copied" : "Copy diagnostics"}
      </Button>

      {state === "failed" ? (
        <div className="mt-2 space-y-1">
          <p className="font-mono text-[11px] text-muted-foreground">
            Could not reach the clipboard. Select and copy this:
          </p>
          <pre className="max-w-xl overflow-x-auto rounded-md border bg-secondary p-2 font-mono text-[11px]">
            {report}
          </pre>
        </div>
      ) : null}
    </div>
  );
};
