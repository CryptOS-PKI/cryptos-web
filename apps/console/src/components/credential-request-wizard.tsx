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

import { CopyBlock } from "@/components/copy-block";
import { DialogFrame } from "@/components/dialog-frame";
import { type BackedUpKey, KeyBackupStep } from "@/components/key-backup-step";
import { Button } from "@/components/ui/button";
import { parseCsr } from "@/lib/crypto/csr";
import { readFileBytes } from "@/lib/download";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { fieldClass, labelClass, looksLikeEmail } from "@/lib/form";
import {
  createCredentialRequest,
  type CreatedCredentialRequest,
  credentialFileBase,
  OPERATOR_LEVELS,
  type OperatorLevel,
} from "@/lib/operators";

type Step = "backup" | "done" | "holder" | "upload";

// CredentialRequestWizard files an operator credential request. The CSR comes
// from a key made here (with the mandatory key backup) or from the holder's
// own machine. The Fleet Manager stores the request and hands back what the CA
// operator needs: the CSR, the OpenSSL extension section for the level and the
// signing command. The external CA signs out of band; Complete records it.
export const CredentialRequestWizard = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (requestId: string, backup: Uint8Array | undefined) => void;
}) => {
  const [step, setStep] = useState<Step>("holder");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<OperatorLevel>("operator");
  const [source, setSource] = useState<"browser" | "upload">("browser");
  const [csrText, setCsrText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [created, setCreated] = useState<CreatedCredentialRequest | null>(null);
  const [heldHere, setHeldHere] = useState(false);

  const cleanEmail = email.trim().toLowerCase();
  const holderReady = fullName.trim().length > 0 && looksLikeEmail(email);

  const file = async (csrDer: Uint8Array, backup?: Uint8Array) => {
    setPending(true);
    setError(null);
    try {
      const result = await createCredentialRequest({ csrDer, email: cleanEmail, fullName, level });
      setCreated(result);
      setHeldHere(backup !== undefined);
      setStep("done");
      onCreated(result.requestId, backup);
    } catch (error_: unknown) {
      setError(fleetErrorMessage(error_, "Filing the request failed."));
    } finally {
      setPending(false);
    }
  };

  const fileUploaded = async () => {
    setError(null);
    try {
      const parsed = await parseCsr(csrText);
      if (parsed.subjectCn.toLowerCase() !== cleanEmail) {
        setError(
          `The CSR is for ${parsed.subjectCn}, not ${cleanEmail}. Its subject must be exactly CN=<the holder's email>.`,
        );
        return;
      }
      await file(parsed.csrDer);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "The CSR could not be read.");
    }
  };

  return (
    <DialogFrame labelId="credential-request-title" onClose={onClose} wide>
      <h2 className="text-lg font-bold" id="credential-request-title">
        Request operator credential
      </h2>

      {step === "holder" ? (
        <>
          <p className="text-xs text-muted-foreground">
            The Fleet Manager never signs operator credentials. This files a request; your operator
            CA signs its CSR out of band, and you record the signed certificate with Complete.
          </p>
          <label className="block space-y-1">
            <span className={labelClass}>Full name</span>
            <input
              className={fieldClass}
              onChange={(e) => setFullName(e.target.value)}
              value={fullName}
            />
          </label>
          <label className="block space-y-1">
            <span className={labelClass}>Email (the certificate&apos;s CN)</span>
            <input
              autoComplete="off"
              className={fieldClass}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="block space-y-1">
            <span className={labelClass}>Access level</span>
            <select
              className={fieldClass}
              onChange={(e) => setLevel(e.target.value as OperatorLevel)}
              value={level}
            >
              {OPERATOR_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-2">
            <legend className={labelClass}>Where the key is made</legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                checked={source === "browser"}
                name="csr-source"
                onChange={() => setSource("browser")}
                type="radio"
              />
              <span>
                Make the key here
                <span className="block text-xs text-muted-foreground">
                  A P-384 key and CSR in this browser, with an encrypted key backup to hand to the
                  holder.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                checked={source === "upload"}
                name="csr-source"
                onChange={() => setSource("upload")}
                type="radio"
              />
              <span>
                Upload a CSR from the holder
                <span className="block text-xs text-muted-foreground">
                  Recommended when practical: the key never leaves the holder. They can make one on
                  the Make a credential request page, or with OpenSSL.
                </span>
              </span>
            </label>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} size="sm" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={!holderReady}
              onClick={() => setStep(source === "browser" ? "backup" : "upload")}
              size="sm"
            >
              Next
            </Button>
          </div>
        </>
      ) : null}

      {step === "backup" ? (
        <>
          <KeyBackupStep
            email={cleanEmail}
            level={level}
            onBackedUp={(key: BackedUpKey) => void file(key.csrDer, key.backup)}
          />
          {pending ? (
            <p className="font-mono text-xs text-muted-foreground" role="status">
              Filing the request&hellip;
            </p>
          ) : null}
        </>
      ) : null}

      {step === "upload" ? (
        <>
          <label className="block space-y-1">
            <span className={labelClass}>Paste the CSR (PEM)</span>
            <textarea
              className={`${fieldClass} h-40`}
              onChange={(e) => setCsrText(e.target.value)}
              value={csrText}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className={`${labelClass} block`}>Or choose the CSR file</span>
            <input
              accept=".csr,.pem,.req"
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                if (chosen) {
                  void readFileBytes(chosen).then((b) => setCsrText(new TextDecoder().decode(b)));
                }
              }}
              type="file"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setStep("holder")} size="sm" variant="outline">
              Back
            </Button>
            <Button
              disabled={csrText.trim() === "" || pending}
              onClick={() => void fileUploaded()}
              size="sm"
            >
              {pending ? "Filing…" : "File the request"}
            </Button>
          </div>
        </>
      ) : null}

      {step === "done" && created ? (
        <>
          <p className="text-sm" role="status">
            Request filed for <span className="font-mono">{cleanEmail}</span> ({level}). It expires{" "}
            <span className="font-mono">{created.expiresAt}</span>.
          </p>
          <CopyBlock
            filename={`${credentialFileBase(level, cleanEmail)}.csr`}
            label="CSR"
            text={created.csrPem}
          />
          <CopyBlock label="OpenSSL extension section" text={created.extfileSection} />
          <CopyBlock label="Signing command" text={created.opensslCommand} />
          <p className="text-xs text-muted-foreground">
            Send the CSR to whoever runs your operator CA. They sign it with the {level} section
            above (never with copy_extensions), then send back the certificate. Record it with
            Complete on the Pending requests tab.
          </p>
          {heldHere ? (
            <p className="text-xs text-muted-foreground">
              This tab keeps the encrypted key backup until you leave the page, so Complete can
              build the PKCS#12 here. After that, Complete takes the backup file and its passphrase.
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={onClose} size="sm">
              Close
            </Button>
          </div>
        </>
      ) : null}

      {error ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </DialogFrame>
  );
};
