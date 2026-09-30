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

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { OperatorLevel } from "@/context/auth";

import { GateShell } from "@/components/layout/auth-gate";
import { CertificateHelp } from "@/components/layout/certificate-help";
import { denialCopy } from "@/components/layout/denial-copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ConsentLoad,
  type ConsentRequest,
  decideConsent,
  leaveForClient,
  loadConsent,
} from "@/lib/oauth-consent";

const labelText = "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

const Message = ({ detail, title }: { detail: string; title: string }) => (
  <div className="flex max-w-md flex-col items-center gap-2 text-center font-mono text-sm text-muted-foreground">
    <span className="text-primary">{title}</span>
    <span>{detail}</span>
  </div>
);

const defaultCeiling = (request: ConsentRequest): OperatorLevel =>
  request.allowedCeilings.includes(request.operator.level)
    ? request.operator.level
    : (request.allowedCeilings.at(-1) ?? "viewer");

const ConsentForm = ({ id, request }: { id: string; request: ConsentRequest }) => {
  const [ceiling, setCeiling] = useState<OperatorLevel>(() => defaultCeiling(request));
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const decide = (approve: boolean) => {
    setPending(true);
    setError(null);
    decideConsent(id, { approve, label: label.trim(), levelCeiling: ceiling })
      .then(leaveForClient)
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "The decision was not recorded.");
        setPending(false);
      });
  };

  return (
    <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-lg font-bold">Authorize an MCP client</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{request.clientName}</span> is asking for
          a key to manage this fleet on your behalf.
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
        <dt className="text-muted-foreground">Returns to</dt>
        <dd className="break-all font-semibold text-foreground">{request.redirectHost}</dd>
        <dt className="text-muted-foreground">Signed in as</dt>
        <dd className="break-all text-foreground">{request.operator.cn}</dd>
        <dt className="text-muted-foreground">Level</dt>
        <dd className="text-foreground">{request.operator.level}</dd>
        <dt className="text-muted-foreground">Serial</dt>
        <dd className="break-all text-foreground">{request.operator.serial}</dd>
      </dl>

      {/* The key outlives this page, and the redirect host is the only thing
          tying the request to the machine that started it, so the operator is
          asked to check it rather than just click through. */}
      <p
        className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-muted-foreground"
        role="note"
      >
        Approve only if you started this sign-in from an agent on the machine above. The key acts as
        you, up to the ceiling below, until it is revoked on the Agent keys page or your certificate
        is revoked or renewed.
      </p>

      <label className="block space-y-1">
        <span className={labelText}>Level ceiling</span>
        <select
          className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm"
          disabled={pending}
          onChange={(e) => setCeiling(e.target.value as OperatorLevel)}
          value={ceiling}
        >
          {request.allowedCeilings.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className={labelText}>Label (optional)</span>
        <Input
          disabled={pending}
          maxLength={120}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. build agent"
          value={label}
        />
      </label>

      {error ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button disabled={pending} onClick={() => decide(false)} size="sm" variant="outline">
          Deny
        </Button>
        <Button disabled={pending} onClick={() => decide(true)} size="sm">
          Approve
        </Button>
      </div>
    </div>
  );
};

// OAuthConsentPage is where an MCP client's sign-in lands in the browser. It sits
// outside the console's login gate: the request itself is authenticated by the
// operator certificate the browser presents, so a separate Log in step would
// only add a click between the agent and its key.
export const OAuthConsentPage = () => {
  const [params] = useSearchParams();
  const id = params.get("req") ?? "";
  const [load, setLoad] = useState<ConsentLoad | null>(null);

  useEffect(() => {
    if (!id) return;
    let live = true;
    void loadConsent(id).then((result) => {
      if (live) setLoad(result);
    });
    return () => {
      live = false;
    };
  }, [id]);

  if (!id) {
    return (
      <GateShell>
        <Message
          detail="Open this page from the sign-in link your MCP client started; it carries the request to approve."
          title="No sign-in request"
        />
      </GateShell>
    );
  }

  if (load === null) {
    return (
      <GateShell>
        <div className="flex items-center gap-3 font-mono text-sm text-muted-foreground">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-primary" />
          Loading the sign-in request&hellip;
        </div>
      </GateShell>
    );
  }

  if (load.kind === "expired") {
    return (
      <GateShell>
        <Message
          detail="This sign-in request is expired or unknown. Start the sign-in again from your MCP client."
          title="Sign-in request not found"
        />
      </GateShell>
    );
  }

  if (load.kind === "denied") {
    return (
      <GateShell>
        <Message {...denialCopy[load.reason]} />
        {load.reason === "no-certificate" || load.reason === "certificate-not-sent" ? (
          <CertificateHelp />
        ) : null}
      </GateShell>
    );
  }

  return (
    <GateShell>
      <ConsentForm id={id} request={load.request} />
    </GateShell>
  );
};
