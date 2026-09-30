/*
Apache License 2.0

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

import type { ReactNode } from "react";

import { CertificateHelp } from "@/components/layout/certificate-help";
import { denialCopy } from "@/components/layout/denial-copy";
import { DiagnosticsCopy } from "@/components/layout/diagnostics-copy";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";

// The landing page, and the gate in front of the routed shell.
//
// This renders for an operator with no certificate at all, which is the whole
// point of it (#68): the manager serves the web surface anonymously, so someone
// who cannot get in is told why instead of meeting a TLS error with no
// explanation. Signing in is an explicit action -- holding a valid certificate
// does not walk you into the console.

export const GateShell = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6">
    <Wordmark className="text-2xl" />
    {children}
    {/* Reachable before sign-in on purpose: an operator who cannot get in is
        the one whose report is worth most, and they have no other surface
        (#83). */}
    <DiagnosticsCopy className="flex flex-col items-center" />
  </div>
);

export const AuthGate = ({ children }: { children: ReactNode }) => {
  const { login, reason, status } = useAuth();

  if (status === "authenticated") {
    return <>{children}</>;
  }

  if (status === "presenting") {
    return (
      <GateShell>
        <div className="flex items-center gap-3 font-mono text-sm text-muted-foreground">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-primary" />
          Checking your operator certificate&hellip;
        </div>
      </GateShell>
    );
  }

  if (status === "denied") {
    const { detail, title } = denialCopy[reason ?? "not-authorized"];

    return (
      <GateShell>
        <div className="flex max-w-md flex-col items-center gap-2 text-center font-mono text-sm text-muted-foreground">
          <span className="text-primary">{title}</span>
          <span>{detail}</span>
        </div>
        {/* Only the missing-certificate cases are something the operator can
            act on here, so they are the only ones that carry instructions. */}
        {reason === "no-certificate" || reason === "certificate-not-sent" ? (
          <CertificateHelp />
        ) : null}
        <Button onClick={login} type="button" variant="outline">
          Try again
        </Button>
      </GateShell>
    );
  }

  return (
    <GateShell>
      <div className="flex max-w-md flex-col items-center gap-2 text-center font-mono text-sm text-muted-foreground">
        <span>Fleet Manager for CryptOS-PKI.</span>
        <span>
          Logging in checks the operator certificate your browser presents and the access level it
          carries.
        </span>
      </div>
      <Button onClick={login} type="button">
        Log in
      </Button>
    </GateShell>
  );
};
