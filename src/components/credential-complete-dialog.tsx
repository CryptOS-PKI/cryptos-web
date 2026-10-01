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

import { DialogFrame } from "@/components/dialog-frame";
import { Button } from "@/components/ui/button";
import {
  buildCredentialPkcs12,
  keyMatchesCertificate,
  readCertificateDer,
  readKeyBackup,
} from "@/lib/crypto/key-backup";
import { base64 } from "@/lib/crypto/leaf-key";
import { downloadBytes, readFileBytes } from "@/lib/download";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { fieldClass, labelClass } from "@/lib/form";
import {
  type CredentialRequestRow,
  type OperatorCredentialRow,
  recordOperatorCredential,
} from "@/lib/operators";

type KeySource = "file" | "held" | "holder";

// CredentialCompleteDialog records a certificate the operator CA signed, for
// a pending request or (with no request) as an out-of-band import. When this
// browser can reach the key, through the backup it still holds or a backup
// file, it checks the key against the certificate before recording and then
// builds the PKCS#12, sealed with the key backup's own passphrase.
export const CredentialCompleteDialog = ({
  heldBackup,
  onClose,
  onRecorded,
  request,
}: {
  heldBackup?: Uint8Array;
  onClose: () => void;
  onRecorded: () => void;
  request: CredentialRequestRow | null;
}) => {
  const [certText, setCertText] = useState("");
  const [fullName, setFullName] = useState("");
  const [keySource, setKeySource] = useState<KeySource>(heldBackup ? "held" : "file");
  const [backupFile, setBackupFile] = useState<null | Uint8Array>(null);
  const [passphrase, setPassphrase] = useState("");
  const [chainText, setChainText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [recorded, setRecorded] = useState<null | OperatorCredentialRow>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [p12Name, setP12Name] = useState("");

  const backupFor = (source: KeySource): null | Uint8Array | undefined => {
    if (source === "held") return heldBackup;
    if (source === "file") return backupFile;
    return undefined;
  };
  const backup = backupFor(keySource);
  const needsKey = keySource !== "holder";
  const ready =
    certText.trim() !== "" &&
    (request !== null || fullName.trim() !== "") &&
    (!needsKey || (backup !== null && backup !== undefined && passphrase !== "")) &&
    !pending;

  const complete = async () => {
    setPending(true);
    setError(null);
    try {
      const certDer = readCertificateDer(new TextEncoder().encode(certText.trim()));
      const chainDer =
        chainText.trim() === ""
          ? []
          : [readCertificateDer(new TextEncoder().encode(chainText.trim()))];

      if (needsKey && backup) {
        const key = await readKeyBackup(backup, passphrase);
        if (!(await keyMatchesCertificate(key, certDer))) {
          throw new Error(
            "The certificate does not match the key in this backup. Check that it was signed from this request's CSR.",
          );
        }
      }

      let result;
      try {
        result = await recordOperatorCredential({
          certDer,
          fullName: request ? undefined : fullName,
          requestId: request?.id,
        });
      } catch (error_: unknown) {
        setError(fleetErrorMessage(error_, "Recording the certificate failed."));
        return;
      }
      setRecorded(result.credential);
      setWarnings(result.warnings);
      onRecorded();

      if (needsKey && backup) {
        const email = result.credential.email || request?.email || "operator";
        const level = result.credential.level || request?.level || "operator";
        const pfx = await buildCredentialPkcs12({
          backup,
          certDer,
          chainDer,
          friendlyName: `FleetOS ${level} (${email})`,
          passphrase,
        });
        const name = `${email}.p12`;
        downloadBytes(name, pfx, "application/x-pkcs12");
        setP12Name(name);
      }
      setPassphrase("");
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "Completing the request failed.");
    } finally {
      setPending(false);
    }
  };

  let submitLabel = needsKey ? "Record and build PKCS#12" : "Record";
  if (pending) submitLabel = "Working…";

  const title = request
    ? `Complete request for ${request.email}`
    : "Record an operator certificate";

  return (
    <DialogFrame labelId="credential-complete-title" onClose={onClose} wide>
      <h2 className="text-lg font-bold" id="credential-complete-title">
        {title}
      </h2>

      {recorded ? (
        <div className="space-y-2">
          <p className="text-sm" role="status">
            Recorded {recorded.commonName} ({recorded.level}), serial{" "}
            <span className="font-mono">{recorded.serialHex}</span>.
          </p>
          {warnings.map((w) => (
            <p className="font-mono text-xs text-warning" key={w}>
              {w}
            </p>
          ))}
          {p12Name ? (
            <p className="text-xs text-muted-foreground">
              PKCS#12 downloaded as <span className="font-mono">{p12Name}</span>. It opens with the
              key backup&apos;s passphrase. Import it into the operator&apos;s browser or OS
              certificate store, then keep the key backup somewhere safe or delete it.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              The holder builds the PKCS#12 with their key:{" "}
              <code className="font-mono">
                openssl pkcs12 -export -inkey &lt;key file&gt; -in &lt;certificate&gt; -certfile
                operator-ca.crt -out &lt;name&gt;.p12
              </code>
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={onClose} size="sm">
              Close
            </Button>
          </div>
        </div>
      ) : (
        <>
          <label className="block space-y-1">
            <span className={labelClass}>Signed certificate (PEM)</span>
            <textarea
              className={`${fieldClass} h-32`}
              onChange={(e) => setCertText(e.target.value)}
              value={certText}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className={`${labelClass} block`}>Or choose the certificate file</span>
            <input
              accept=".crt,.pem,.cer,.der"
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                if (chosen) {
                  void readFileBytes(chosen).then((b) => {
                    try {
                      const der = readCertificateDer(b);
                      setCertText(
                        `-----BEGIN CERTIFICATE-----\n${base64(der)}\n-----END CERTIFICATE-----\n`,
                      );
                    } catch (error_: unknown) {
                      setError(error_ instanceof Error ? error_.message : "Unreadable certificate");
                    }
                  });
                }
              }}
              type="file"
            />
          </label>

          {request ? null : (
            <label className="block space-y-1">
              <span className={labelClass}>Holder&apos;s full name</span>
              <input
                className={fieldClass}
                onChange={(e) => setFullName(e.target.value)}
                value={fullName}
              />
            </label>
          )}

          <fieldset className="space-y-2">
            <legend className={labelClass}>The private key</legend>
            {heldBackup ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={keySource === "held"}
                  name="key-source"
                  onChange={() => setKeySource("held")}
                  type="radio"
                />
                Key backup held in this browser
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={keySource === "file"}
                name="key-source"
                onChange={() => setKeySource("file")}
                type="radio"
              />
              From the key backup file
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={keySource === "holder"}
                name="key-source"
                onChange={() => setKeySource("holder")}
                type="radio"
              />
              The holder has the key (record only, no PKCS#12 here)
            </label>
          </fieldset>

          {keySource === "file" ? (
            <label className="block space-y-1 text-xs">
              <span className={`${labelClass} block`}>Key backup file</span>
              <input
                accept=".pem,.key"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) void readFileBytes(chosen).then(setBackupFile);
                }}
                type="file"
              />
            </label>
          ) : null}
          {needsKey ? (
            <>
              <label className="block space-y-1">
                <span className={labelClass}>Key backup passphrase</span>
                <input
                  autoComplete="off"
                  className={fieldClass}
                  onChange={(e) => setPassphrase(e.target.value)}
                  type="password"
                  value={passphrase}
                />
              </label>
              <label className="block space-y-1">
                <span className={labelClass}>Operator CA certificate for the chain (optional)</span>
                <textarea
                  className={`${fieldClass} h-20`}
                  onChange={(e) => setChainText(e.target.value)}
                  value={chainText}
                />
              </label>
            </>
          ) : null}

          {error ? (
            <p className="font-mono text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button onClick={onClose} size="sm" variant="outline">
              Cancel
            </Button>
            <Button disabled={!ready} onClick={() => void complete()} size="sm">
              {submitLabel}
            </Button>
          </div>
        </>
      )}
    </DialogFrame>
  );
};
