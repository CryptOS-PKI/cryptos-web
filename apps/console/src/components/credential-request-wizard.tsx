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

import {
  Button,
  CopyBlock,
  Dialog,
  Field,
  Input,
  inputClasses,
  KeyBackupStep,
  Notice,
} from "@cryptos-pki/ui";
import { useEffect, useState } from "react";

import { parseCsr } from "@/lib/crypto/csr";
import { generateBackupPassphrase, keyBackupFilename, keyBackupPem } from "@/lib/crypto/key-backup";
import { generateLeafKeyAndCSR } from "@/lib/crypto/leaf-key";
import { downloadText, readFileBytes } from "@/lib/download";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { looksLikeEmail } from "@/lib/form";
import {
  createCredentialRequest,
  type CreatedCredentialRequest,
  credentialFileBase,
  OPERATOR_LEVELS,
  type OperatorLevel,
} from "@/lib/operators";

type Step = "backup" | "done" | "holder" | "upload";

const legendClass = "font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground";

interface MadeKey {
  backupPem: string;
  csrDer: Uint8Array;
  passphrase: string;
}

// useMadeKey makes a P-384 key and a CSR (CN=<email>, asking for the level's
// profile) in the browser once the wizard reaches the backup step, then builds
// the encrypted key backup. The private key itself is dropped once the backup
// is made; only the backup bytes and its passphrase are kept, both discarded
// when the wizard closes.
const useMadeKey = (active: boolean, email: string, level: OperatorLevel) => {
  const [made, setMade] = useState<MadeKey | null>(null);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        const { csrDer, privateKey } = await generateLeafKeyAndCSR({
          extensionRequest: { level },
          sans: [],
          subjectCn: email,
        });
        const passphrase = generateBackupPassphrase();
        const backupPem = await keyBackupPem(privateKey, passphrase);
        if (!cancelled) setMade({ backupPem, csrDer, passphrase });
      } catch (error_: unknown) {
        if (!cancelled)
          setError(error_ instanceof Error ? error_.message : "Key generation failed");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per activation of the step
  }, [active]);

  return { error, made };
};

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
  const { error: keyError, made } = useMadeKey(step === "backup", cleanEmail, level);

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

  const footer = () => {
    if (step === "holder")
      return (
        <>
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
        </>
      );
    if (step === "upload")
      return (
        <>
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
        </>
      );
    if (step === "done")
      return (
        <Button onClick={onClose} size="sm">
          Close
        </Button>
      );
    return;
  };

  const backupBody = () => {
    if (keyError)
      return (
        <Notice role="alert" tone="danger">
          {keyError}
        </Notice>
      );
    if (!made)
      return (
        <p className="font-mono text-xs text-muted-foreground" role="status">
          Making a P-384 key and CSR in this browser&hellip;
        </p>
      );
    return (
      <KeyBackupStep
        filename={keyBackupFilename(level, cleanEmail)}
        onContinue={() => void file(made.csrDer, new TextEncoder().encode(made.backupPem))}
        onDownload={() =>
          downloadText(
            keyBackupFilename(level, cleanEmail),
            made.backupPem,
            "application/x-pem-file",
          )
        }
        passphrase={made.passphrase}
        warning={
          <>
            <p className="font-semibold">Save the key backup and its passphrase</p>
            <p>
              The private key was made in this browser and never goes to the Fleet Manager. Download
              the encrypted key backup and store the passphrase in a password manager. The
              passphrase is shown only here, once; the same passphrase will protect the PKCS#12.
              Without both, the key is lost and the request has to start again.
            </p>
          </>
        }
      />
    );
  };

  return (
    <Dialog
      footer={footer()}
      onClose={onClose}
      open
      title="Request operator credential"
      variant="wide"
    >
      {step === "holder" ? (
        <>
          <p className="text-xs text-muted-foreground">
            The Fleet Manager never signs operator credentials. This files a request; your operator
            CA signs its CSR out of band, and you record the signed certificate with Complete.
          </p>
          <Field label="Full name">
            <Input onChange={(e) => setFullName(e.target.value)} value={fullName} />
          </Field>
          <Field label="Email (the certificate's CN)">
            <Input
              autoComplete="off"
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              value={email}
            />
          </Field>
          <Field label="Access level">
            <select
              className={inputClasses}
              onChange={(e) => setLevel(e.target.value as OperatorLevel)}
              value={level}
            >
              {OPERATOR_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="space-y-2">
            <legend className={legendClass}>Where the key is made</legend>
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
        </>
      ) : null}

      {step === "backup" ? (
        <>
          {backupBody()}
          {pending ? (
            <p className="font-mono text-xs text-muted-foreground" role="status">
              Filing the request&hellip;
            </p>
          ) : null}
        </>
      ) : null}

      {step === "upload" ? (
        <>
          <Field label="Paste the CSR (PEM)">
            <textarea
              className={`${inputClasses} h-40`}
              onChange={(e) => setCsrText(e.target.value)}
              value={csrText}
            />
          </Field>
          <Field label="Or choose the CSR file">
            <Input
              accept=".csr,.pem,.req"
              mono={false}
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                if (chosen) {
                  void readFileBytes(chosen).then((b) => setCsrText(new TextDecoder().decode(b)));
                }
              }}
              type="file"
            />
          </Field>
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
            onDownload={downloadText}
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
        </>
      ) : null}

      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
    </Dialog>
  );
};
