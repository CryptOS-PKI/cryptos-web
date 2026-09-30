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

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  generateLeafKeyAndCSR,
  generateStrongPassphrase,
  MIN_PASSPHRASE_LENGTH,
} from "@/lib/crypto/leaf-key";
import { assemblePkcs12 } from "@/lib/crypto/pkcs12";
import { issueOperatorCredential, type OperatorLevel } from "@/lib/operators";

const field = "w-full rounded-md border bg-card px-3 py-2 font-mono text-sm";
const label = "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

const levels: OperatorLevel[] = ["viewer", "operator", "admin"];

// download triggers a browser download of the .p12 bytes without leaving a URL
// object behind. The bytes are copied into a fresh view so the Blob part type
// is unambiguous; the PKCS#12 is opaque and never rendered on screen.
const download = (filename: string, contents: Uint8Array): void => {
  const copy = new Uint8Array(contents.length);
  copy.set(contents);
  const url = URL.createObjectURL(new Blob([copy], { type: "application/x-pkcs12" }));
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
};

// OperatorIssueDialog issues an operator credential end-to-end in the browser:
// it mints an ECDSA keypair + CSR (leaf-key), asks the manager to sign the CSR
// under the operator-<level> profile (issueOperatorCredential), and assembles a
// passphrase-sealed PKCS#12 (pkcs12) from the returned cert and the browser-held
// key, which the operator downloads. Double-guarded like the escrow export: a
// >= 18-character passphrase (typed or generated) AND a typed confirmation are
// both required before the download button enables. The private key and the
// passphrase are never logged and never rendered back.
export const OperatorIssueDialog = ({
  onClose,
  onIssued,
}: {
  onClose: () => void;
  onIssued: () => void;
}) => {
  const [commonName, setCommonName] = useState("");
  const [level, setLevel] = useState<OperatorLevel>("operator");
  const [passphrase, setPassphrase] = useState("");
  const [reveal, setReveal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [done, setDone] = useState(false);

  const cn = commonName.trim();
  const passphraseLongEnough = passphrase.length >= MIN_PASSPHRASE_LENGTH;
  const confirmed = confirmText === "ISSUE" || (cn.length > 0 && confirmText === cn);
  const ready = cn.length > 0 && passphraseLongEnough && confirmed && !pending;

  const confirm = () => {
    if (!ready) return;
    setPending(true);
    setError(null);
    // The whole issue-then-pack sequence: mint key+CSR, sign via the manager,
    // assemble the sealed PKCS#12, download. Any failure surfaces inline.
    void (async () => {
      try {
        const { csrDer, privateKey } = await generateLeafKeyAndCSR({ sans: [], subjectCn: cn });
        const { certDer } = await issueOperatorCredential(cn, level, csrDer);
        const pfx = await assemblePkcs12(certDer, privateKey, passphrase);
        download(`${cn}-operator.p12`, pfx);
        // Clear the passphrase from state the moment it is no longer needed.
        setPassphrase("");
        setConfirmText("");
        setDone(true);
        onIssued();
      } catch (error_: unknown) {
        setError(error_ instanceof Error ? error_.message : "Issue failed");
      } finally {
        setPending(false);
      }
    })();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-labelledby="operator-issue-title"
        aria-modal="true"
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <h2 className="text-lg font-bold" id="operator-issue-title">
          Issue operator credential
        </h2>

        {done ? (
          <p className="font-mono text-xs text-success" role="status">
            Operator PKCS#12 downloaded.
          </p>
        ) : (
          <>
            <div
              className="space-y-1 rounded-md border border-warning/40 bg-warning/10 p-3"
              role="note"
            >
              <p className="text-xs text-muted-foreground">
                The keypair is generated in this browser. The signed credential downloads as a
                passphrase-protected PKCS#12. Save the passphrase before issuing — it is required to
                open the PKCS#12 and cannot be recovered afterward.
              </p>
            </div>

            <label className="block space-y-1">
              <span className={label}>Common name</span>
              <input
                className={field}
                onChange={(e) => setCommonName(e.target.value)}
                value={commonName}
              />
            </label>

            <label className="block space-y-1">
              <span className={label}>Access level</span>
              <select
                className={field}
                onChange={(e) => setLevel(e.target.value as OperatorLevel)}
                value={level}
              >
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className={label}>PKCS#12 passphrase (min {MIN_PASSPHRASE_LENGTH})</span>
              <input
                autoComplete="new-password"
                className={field}
                onChange={(e) => setPassphrase(e.target.value)}
                type={reveal ? "text" : "password"}
                value={passphrase}
              />
            </label>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setPassphrase(generateStrongPassphrase());
                  setReveal(true);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Generate strong passphrase
              </Button>
              <Button
                onClick={() => setReveal((r) => !r)}
                size="sm"
                type="button"
                variant="outline"
              >
                {reveal ? "Hide" : "Show"}
              </Button>
              <Button
                disabled={passphrase.length === 0}
                onClick={() => void navigator.clipboard?.writeText(passphrase)}
                size="sm"
                type="button"
                variant="outline"
              >
                Copy
              </Button>
            </div>
            {passphrase.length > 0 ? (
              <p className="font-mono text-xs text-muted-foreground">
                Save this passphrase now — it is required to open the PKCS#12 and is not
                recoverable.
              </p>
            ) : null}
            {passphrase.length > 0 && !passphraseLongEnough ? (
              <p className="font-mono text-xs text-destructive" role="alert">
                Passphrase must be at least {MIN_PASSPHRASE_LENGTH} characters.
              </p>
            ) : null}

            <label className="block space-y-1">
              <span className={label}>Type the CN or ISSUE to confirm</span>
              <input
                className={field}
                onChange={(e) => setConfirmText(e.target.value)}
                value={confirmText}
              />
            </label>

            {error ? (
              <p className="font-mono text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} size="sm" variant="outline">
            {done ? "Close" : "Cancel"}
          </Button>
          {done ? null : (
            <Button disabled={!ready} onClick={confirm} size="sm">
              {pending ? "Issuing…" : "Issue and download"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
