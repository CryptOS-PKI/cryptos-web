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

import { Button, FingerprintConfirm, Notice } from "@cryptos-pki/ui";
import { useEffect, useState } from "react";

import type { RegisterForm, RegisterResult } from "@/lib/operator-cas";

import { OperatorCARegisterForm } from "@/components/operator-ca-register-form";
import { registerOperatorCABootstrap } from "@/lib/bootstrap";
import { readCertificateDer } from "@/lib/crypto/key-backup";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";

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
  const [matches, setMatches] = useState(false);
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
        <FingerprintConfirm
          actions={
            <>
              <Button onClick={() => setReplace(true)} size="sm" variant="outline">
                Register a different CA
              </Button>
              <Button disabled={!matches || pending} onClick={() => void reconfirm()} size="sm">
                Confirm this CA
              </Button>
            </>
          }
          compare
          fingerprint={ca.sha256}
          fingerprintLabel="sha256"
          onCompare={setMatches}
          subject={[["subject", ca.subject]]}
          title="An operator CA is already registered"
          tone="warning"
        >
          Confirm it is yours before you continue. On the CA machine, run{" "}
          <code className="font-mono">
            openssl x509 -in operator-ca.crt -noout -fingerprint -sha256
          </code>{" "}
          and paste the output below. If it doesn&apos;t match, register your own CA: that retires
          this one immediately.
        </FingerprintConfirm>
        {error ? (
          <Notice role="alert" tone="danger">
            {error}
          </Notice>
        ) : null}
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
