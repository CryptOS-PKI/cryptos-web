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

import { useEffect, useState } from "react";

import type { RegisterForm, RegisterResult } from "@/lib/operator-cas";

import { OperatorCARegisterForm } from "@/components/operator-ca-register-form";
import { Button } from "@/components/ui/button";
import { registerOperatorCABootstrap } from "@/lib/bootstrap";
import { readCertificateDer } from "@/lib/crypto/key-backup";
import { colonFingerprint, normalizeFingerprint } from "@/lib/fingerprint";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { fieldClass, labelClass } from "@/lib/form";

const EMPTY_FORM: RegisterForm = {
  caCertDer: new Uint8Array(),
  confirmSha256: "",
  crl: { kind: "none" },
  ocspMode: "aia",
  ocspUrl: "",
};

const derOf = (bytes: Uint8Array): null | Uint8Array => {
  try {
    return readCertificateDer(bytes);
  } catch {
    return null;
  }
};

// CaStep registers the external operator CA. When first run was already
// started, a CA may be registered already: a new session keeps it but must
// confirm its fingerprint again, so the operator always sees what they trust,
// including a CA someone else registered with a leaked token.
export const CaStep = ({
  inProgress,
  onRegistered,
}: {
  inProgress: boolean;
  onRegistered: (result: RegisterResult, anchorDer: null | Uint8Array) => void;
}) => {
  const [current, setCurrent] = useState<"none" | null | RegisterResult>(
    inProgress ? null : "none",
  );
  const [replace, setReplace] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    if (!inProgress) return;
    let cancelled = false;
    registerOperatorCABootstrap(EMPTY_FORM)
      .then((r) => {
        if (!cancelled) setCurrent(r.operatorCa.sha256 ? r : "none");
      })
      .catch(() => {
        if (!cancelled) setCurrent("none");
      });
    return () => {
      cancelled = true;
    };
  }, [inProgress]);

  if (current === null) {
    return (
      <p className="font-mono text-xs text-muted-foreground" role="status">
        Looking for a registered operator CA&hellip;
      </p>
    );
  }

  if (current !== "none" && !replace) {
    const ca = current.operatorCa;
    const matches = normalizeFingerprint(pasted) === ca.sha256;
    const reconfirm = async () => {
      setPending(true);
      setError(null);
      try {
        const result = await registerOperatorCABootstrap({
          ...EMPTY_FORM,
          confirmSha256: ca.sha256,
        });
        onRegistered(result.confirmed ? result : { ...current, confirmed: true }, null);
      } catch (error_: unknown) {
        setError(fleetErrorMessage(error_, "Confirming the operator CA failed."));
      } finally {
        setPending(false);
      }
    };
    return (
      <div className="space-y-3">
        <p className="text-sm">
          An operator CA is already registered: <span className="font-mono">{ca.subject}</span>.
          Confirm it is yours before you continue.
        </p>
        <code className="block break-all rounded-md border bg-secondary/40 p-2 font-mono text-xs">
          {colonFingerprint(ca.sha256)}
        </code>
        <p className="text-xs text-muted-foreground">
          On the CA machine, run{" "}
          <code className="font-mono">
            openssl x509 -in operator-ca.crt -noout -fingerprint -sha256
          </code>{" "}
          and paste the output. If it doesn&apos;t match, register your own CA: that retires this
          one immediately.
        </p>
        <label className="block space-y-1">
          <span className={labelClass}>Paste the fingerprint from the CA machine</span>
          <input
            className={fieldClass}
            onChange={(e) => setPasted(e.target.value)}
            value={pasted}
          />
        </label>
        {error ? (
          <p className="font-mono text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={() => setReplace(true)} size="sm" variant="outline">
            Register a different CA
          </Button>
          <Button disabled={!matches || pending} onClick={() => void reconfirm()} size="sm">
            Confirm this CA
          </Button>
        </div>
      </div>
    );
  }

  return (
    <OperatorCARegisterForm
      onRegistered={(result, form) => onRegistered(result, derOf(form.caCertDer))}
      submit={registerOperatorCABootstrap}
    />
  );
};
