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

import { BootstrapState } from "@cryptos-pki/api-client/cryptos/fleet/v1/bootstrap_pb";
import { ErrorReason } from "@cryptos-pki/api-client/cryptos/fleet/v1/errors_pb";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { FirstRunWizard } from "@/components/first-run/first-run-wizard";
import { GateShell } from "@/components/layout/auth-gate";
import { useAuth } from "@/context/auth";
import { type BootstrapStatus, getBootstrapState } from "@/lib/bootstrap";

const UNAVAILABLE_COPY: Partial<Record<ErrorReason, string>> = {
  [ErrorReason.DATABASE_REQUIRED]:
    "First run needs Postgres (database_url), which this Fleet Manager runs without, and no operator CA is configured. Set operatorCAPath, or add a database, and restart it.",
  [ErrorReason.FIRST_RUN_DISABLED]:
    "First run is switched off (firstRun: disabled) and no operator CA is configured. Set operatorCAPath and restart the Fleet Manager.",
};

const Checking = ({ text }: { text: string }) => (
  <GateShell>
    <div className="flex items-center gap-3 font-mono text-sm text-muted-foreground">
      <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-primary" />
      {text}
    </div>
  </GateShell>
);

// BootstrapGate asks GetBootstrapState before anything else. Closed, not
// applicable, or a manager without first run: the normal sign-in. Open: try
// WhoAmI first, because a browser that already holds an admin certificate
// from the registered CA closes first run by signing in; otherwise show the
// first-run wizard. Unavailable: say why, then the normal sign-in.
export const BootstrapGate = ({ children }: { children: ReactNode }) => {
  const { login, status } = useAuth();
  const [bootstrap, setBootstrap] = useState<"unknown" | BootstrapStatus | null>(null);
  const tried = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getBootstrapState()
      .then((s) => {
        if (!cancelled) setBootstrap(s);
      })
      .catch((error_: unknown) => {
        console.info("fleet: GetBootstrapState unavailable; using the normal sign-in", error_);
        if (!cancelled) setBootstrap("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open =
    bootstrap !== null &&
    bootstrap !== "unknown" &&
    (bootstrap.state === BootstrapState.OPEN ||
      bootstrap.state === BootstrapState.OPEN_IN_PROGRESS);

  useEffect(() => {
    if (open && !tried.current) {
      tried.current = true;
      login();
    }
  }, [open, login]);

  if (bootstrap === null) {
    return <Checking text="Checking the Fleet Manager…" />;
  }

  if (open) {
    if (status === "authenticated") return <>{children}</>;
    if (status === "denied") {
      return (
        <FirstRunWizard
          inProgress={bootstrap.state === BootstrapState.OPEN_IN_PROGRESS}
          tokenExpiresAt={bootstrap.tokenExpiresAt}
        />
      );
    }
    return <Checking text="Checking for an operator certificate…" />;
  }

  if (bootstrap !== "unknown" && bootstrap.state === BootstrapState.UNAVAILABLE) {
    return (
      <>
        <p
          className="mx-auto mt-4 max-w-xl rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-muted-foreground"
          role="note"
        >
          {UNAVAILABLE_COPY[bootstrap.reasonCode] ??
            "First run is unavailable on this Fleet Manager, and no operator CA is configured."}
        </p>
        {children}
      </>
    );
  }

  return <>{children}</>;
};
