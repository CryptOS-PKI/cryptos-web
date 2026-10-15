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

import { Button, Field, Input, Notice } from "@cryptos-pki/ui";
import { useState } from "react";

import { startBootstrapSession } from "@/lib/bootstrap";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";

const legendClass = "font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground";

const Command = ({ children }: { children: string }) => (
  <code className="block break-all rounded-md border bg-secondary/40 px-2 py-1 font-mono text-[11px]">
    {children}
  </code>
);

// TokenStep starts the first-run session with the bootstrap token from the
// manager's log. The fingerprint check comes first: the server certificate is
// self-signed, so comparing its SHA-256 with the log is the only defence
// against someone in the middle capturing the token.
export const TokenStep = ({
  inProgress,
  onStarted,
  tokenExpiresAt,
}: {
  inProgress: boolean;
  onStarted: () => void;
  tokenExpiresAt: string;
}) => {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      await startBootstrapSession(token);
      setToken("");
      onStarted();
    } catch (error_: unknown) {
      setError(fleetErrorMessage(error_, "Starting first run failed."));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Notice role="note" title="Check the fingerprint first" tone="danger">
        This Fleet Manager serves a self-signed certificate until you give it one. Before you type
        the token, open the certificate details from the browser&apos;s address bar and compare its
        SHA-256 fingerprint with the <code className="font-mono">server certificate SHA-256</code>{" "}
        line in the Fleet Manager&apos;s log. If they differ, stop: someone may be intercepting the
        connection, and the token would be theirs.
      </Notice>

      {inProgress ? (
        <Notice tone="warning">
          First run was already started. If that wasn&apos;t you, continue with the newest token
          from the log. That ends the earlier session, and replacing the registered CA retires
          anything it trusted.
        </Notice>
      ) : null}

      <div className="space-y-1 rounded-md border p-3">
        <p className="text-sm font-semibold">Before you start</p>
        <p className="text-xs text-muted-foreground">
          You need an external operator CA: an OpenSSL CA, or an enterprise or offline CA that can
          issue the operator certificate profile. Have its CA certificate file, and a way to get a
          CSR signed by it. A CryptOS node can&apos;t be the operator CA.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Find the bootstrap token</p>
        <p className="text-xs text-muted-foreground">
          The Fleet Manager prints a single-use token in its log at start, and a new one each time
          one is used or expires. Take the newest.
        </p>
        <p className={legendClass}>Linux / macOS</p>
        <Command>{"docker logs <container> 2>&1 | grep 'bootstrap token'"}</Command>
        <Command>{"journalctl -u fleet-manager | grep 'bootstrap token'"}</Command>
        <p className={legendClass}>Windows (PowerShell)</p>
        <Command>{"docker logs <container> 2>&1 | Select-String 'bootstrap token'"}</Command>
        {tokenExpiresAt ? (
          <p className="text-xs text-muted-foreground">
            The current token expires at <span className="font-mono">{tokenExpiresAt}</span>.
          </p>
        ) : null}
      </div>

      <Field label="Bootstrap token">
        <Input
          autoComplete="off"
          onChange={(e) => setToken(e.target.value)}
          placeholder="fos_boot_..."
          spellCheck={false}
          value={token}
        />
      </Field>
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
      <div className="flex justify-end">
        <Button disabled={token.trim() === "" || pending} onClick={() => void start()} size="sm">
          {pending ? "Starting…" : "Start first run"}
        </Button>
      </div>
    </div>
  );
};
