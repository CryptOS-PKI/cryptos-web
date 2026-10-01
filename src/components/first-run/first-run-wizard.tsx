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

import { AdminStep } from "@/components/first-run/admin-step";
import { CaStep } from "@/components/first-run/ca-step";
import { TokenStep } from "@/components/first-run/token-step";
import { CertificateHelp } from "@/components/layout/certificate-help";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import { endBootstrapSession } from "@/lib/bootstrap";
import { levelExtfileSection } from "@/lib/operators";

type Step = "admin" | "ca" | "install" | "token";

const STEPS: { id: Step; label: string }[] = [
  { id: "token", label: "Token" },
  { id: "ca", label: "Operator CA" },
  { id: "admin", label: "First admin" },
  { id: "install", label: "Install" },
];

const InstallStep = () => (
  <div className="space-y-4">
    <h2 className="text-lg font-bold">Install your admin certificate</h2>
    <p className="text-sm text-muted-foreground">
      Import the PKCS#12 with its passphrase (the key backup&apos;s), then reload this page and
      choose the FleetOS certificate when the browser asks. If it doesn&apos;t ask, quit the browser
      fully and start it again: Chrome remembers a &quot;no certificate&quot; answer per site. Your
      first sign-in as admin closes first run.
    </p>
    <CertificateHelp />
    <p className="text-xs text-muted-foreground">
      Keep the key backup somewhere safe, or delete it once the PKCS#12 is imported.
    </p>
    <Button onClick={() => globalThis.location.reload()} size="sm">
      Reload and sign in
    </Button>
  </div>
);

// FirstRunWizard stands a Fleet Manager up from nothing: the bootstrap token,
// then the external operator CA (with the fingerprint confirm), then the
// first admin certificate, which that CA signs, then the install hand-off.
// The session secret stays in memory; leaving or reloading the page drops it.
export const FirstRunWizard = ({
  inProgress,
  tokenExpiresAt,
}: {
  inProgress: boolean;
  tokenExpiresAt: string;
}) => {
  const [step, setStep] = useState<Step>("token");
  const [anchorDer, setAnchorDer] = useState<null | Uint8Array>(null);
  const [adminExtfile, setAdminExtfile] = useState(levelExtfileSection("admin"));

  const restart = () => {
    endBootstrapSession();
    setStep("token");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-background px-6 py-10">
      <Wordmark className="text-2xl" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">First run</h1>
        <p className="text-sm text-muted-foreground">
          No operator can sign in yet. Register your operator CA and get the first admin
          certificate.
        </p>
        <ol className="flex gap-3 font-mono text-[11px] uppercase tracking-wider">
          {STEPS.map((s) => (
            <li
              aria-current={s.id === step ? "step" : undefined}
              className={s.id === step ? "text-primary" : "text-muted-foreground"}
              key={s.id}
            >
              {s.label}
            </li>
          ))}
        </ol>
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        {step === "token" ? (
          <TokenStep
            inProgress={inProgress}
            onStarted={() => setStep("ca")}
            tokenExpiresAt={tokenExpiresAt}
          />
        ) : null}
        {step === "ca" ? (
          <>
            <h2 className="text-lg font-bold">Register your operator CA</h2>
            <CaStep
              inProgress={inProgress}
              onRegistered={(result, der) => {
                setAnchorDer(der);
                if (result.adminExtfile) setAdminExtfile(result.adminExtfile);
                setStep("admin");
              }}
            />
          </>
        ) : null}
        {step === "admin" ? (
          <>
            <h2 className="text-lg font-bold">First admin certificate</h2>
            <AdminStep
              adminExtfile={adminExtfile}
              anchorDer={anchorDer}
              onDone={() => setStep("install")}
            />
          </>
        ) : null}
        {step === "install" ? <InstallStep /> : null}
      </section>

      {step === "ca" || step === "admin" ? (
        <button
          className="self-start text-xs text-primary underline"
          onClick={restart}
          type="button"
        >
          Session ended? Start again with a new token
        </button>
      ) : null}
    </main>
  );
};
