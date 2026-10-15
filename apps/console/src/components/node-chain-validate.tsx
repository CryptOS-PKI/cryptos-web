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

import { Button, Field, FieldTile, FieldTiles, inputClasses, Notice } from "@cryptos-pki/ui";
import { useState } from "react";

import { useOptionalAuth } from "@/context/auth";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import {
  validateCertificateChain,
  type ValidateCertificateChainResult,
} from "@/lib/node-chain-validate";

// NodeChainValidate lets an operator paste a certificate and check whether it
// chains to a managed node's CA. It parses operator-supplied certificate
// material, so submitting it needs operator level or above; viewers see the
// form disabled, the same read-only pattern the enrollment page uses.
export const NodeChainValidate = ({ nodeName }: { nodeName: string }) => {
  const operator = useOptionalAuth()?.operator;
  const canValidate = operator ? operator.level !== "viewer" : false;

  const [certificatePem, setCertificatePem] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<null | ValidateCertificateChainResult>(null);

  const submit = async () => {
    setError("");
    setPending(true);
    try {
      setResult(await validateCertificateChain(nodeName, certificatePem));
    } catch (error_) {
      setError(fleetErrorMessage(error_, "Failed to validate the certificate"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-xl space-y-3">
      <Field label="Certificate (PEM)">
        <textarea
          className={`${inputClasses} h-32 font-mono text-[11px]`}
          disabled={!canValidate}
          onChange={(e) => setCertificatePem(e.target.value)}
          placeholder="-----BEGIN CERTIFICATE-----"
          spellCheck={false}
          value={certificatePem}
        />
      </Field>
      {canValidate ? null : (
        <p className="font-mono text-xs text-muted-foreground">
          Read-only — your operator level cannot validate a certificate chain.
        </p>
      )}
      <Button
        disabled={!canValidate || pending || certificatePem.trim() === ""}
        onClick={() => void submit()}
        size="sm"
        type="button"
      >
        {pending ? "Validating…" : "Validate"}
      </Button>
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
      {result ? (
        <div className="space-y-3">
          <Notice role="status" tone={result.valid ? "success" : "danger"}>
            {result.valid
              ? `Chains to ${nodeName}'s CA.`
              : `Does not chain to ${nodeName}'s CA: ${result.reason}`}
          </Notice>
          <FieldTiles columns={1}>
            <FieldTile label="Subject" mono value={result.subject} />
            <FieldTile label="Issuer" mono value={result.issuer} />
            <FieldTile label="Node CA subject" mono value={result.nodeCaSubject} />
          </FieldTiles>
        </div>
      ) : null}
    </div>
  );
};
