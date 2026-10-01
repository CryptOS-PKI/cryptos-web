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
import { KeyBackupStep } from "@/components/key-backup-step";
import { Button } from "@/components/ui/button";
import { type FirstAdminResult, submitFirstAdminCertificate } from "@/lib/bootstrap";
import {
  buildCredentialPkcs12,
  keyMatchesCertificate,
  readCertificateDer,
  readKeyBackup,
} from "@/lib/crypto/key-backup";
import { downloadBytes, readFileBytes } from "@/lib/download";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { fieldClass, labelClass, looksLikeEmail } from "@/lib/form";
import { credentialFileBase, csrToPem, levelOpensslCommand } from "@/lib/operators";

const SessionCaution = () => (
  <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-muted-foreground">
    The first-run session ends after 15 minutes without a call. If it ends while you are at the CA,
    start again with the newest token from the log, confirm the CA&apos;s fingerprint again, and
    continue from your key backup.
  </p>
);

const certFrom = (text: string): Uint8Array =>
  readCertificateDer(new TextEncoder().encode(text.trim()));

// PathA: the browser makes the admin's P-384 key and CSR, with the key backup
// saved first. The CA signs the CSR out of band; the signed certificate comes
// back here, the manager checks and records it, and the browser builds the
// PKCS#12 with the backup's passphrase.
const PathA = ({
  adminExtfile,
  anchorDer,
  onDone,
}: {
  adminExtfile: string;
  anchorDer: null | Uint8Array;
  onDone: () => void;
}) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"details" | "make" | "upload">("details");
  const [backup, setBackup] = useState<null | Uint8Array>(null);
  const [csrDer, setCsrDer] = useState<null | Uint8Array>(null);
  const [certText, setCertText] = useState("");
  const [chainText, setChainText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [result, setResult] = useState<FirstAdminResult | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const detailsReady = fullName.trim() !== "" && looksLikeEmail(email);

  const record = async () => {
    setPending(true);
    setError(null);
    try {
      const certDer = certFrom(certText);
      let chainDer: Uint8Array[] = [];
      if (anchorDer) chainDer = [anchorDer];
      else if (chainText.trim()) chainDer = [certFrom(chainText)];
      const key = await readKeyBackup(backup ?? new Uint8Array(), passphrase);
      if (!(await keyMatchesCertificate(key, certDer))) {
        throw new Error(
          "The certificate does not match the key in this backup. Check that it was signed from this CSR.",
        );
      }
      let recorded: FirstAdminResult;
      try {
        recorded = await submitFirstAdminCertificate({
          certDer,
          csrDer: csrDer ?? undefined,
          fullName,
        });
      } catch (error_: unknown) {
        setError(fleetErrorMessage(error_, "Recording the certificate failed."));
        return;
      }
      setResult(recorded);
      const pfx = await buildCredentialPkcs12({
        backup: backup ?? new Uint8Array(),
        certDer,
        chainDer,
        friendlyName: `FleetOS admin (${cleanEmail})`,
        passphrase,
      });
      downloadBytes(`${cleanEmail}.p12`, pfx, "application/x-pkcs12");
      setPassphrase("");
      onDone();
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "Building the PKCS#12 failed.");
    } finally {
      setPending(false);
    }
  };

  if (mode === "details") {
    return (
      <div className="space-y-3">
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
        <div className="flex justify-end gap-2">
          <Button
            disabled={!detailsReady}
            onClick={() => setMode("upload")}
            size="sm"
            variant="outline"
          >
            I already have a key backup
          </Button>
          <Button disabled={!detailsReady} onClick={() => setMode("make")} size="sm">
            Make my admin key and CSR
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "make" && !csrDer) {
    return (
      <KeyBackupStep
        email={cleanEmail}
        level="admin"
        onBackedUp={(key) => {
          setBackup(key.backup);
          setCsrDer(key.csrDer);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {csrDer ? (
        <>
          <CopyBlock
            filename={`${credentialFileBase("admin", cleanEmail)}.csr`}
            label="CSR"
            text={csrToPem(csrDer)}
          />
          <CopyBlock label="Admin extension section" text={adminExtfile} />
          <CopyBlock label="Signing command" text={levelOpensslCommand("admin", cleanEmail)} />
          <p className="text-xs text-muted-foreground">
            Take the CSR to your operator CA and sign it with the admin section above (add it to the
            CA&apos;s OpenSSL config; never copy extensions from the CSR). Bring back the signed
            certificate.
          </p>
          <SessionCaution />
        </>
      ) : (
        <label className="block space-y-1 text-xs">
          <span className={`${labelClass} block`}>Key backup file</span>
          <input
            accept=".pem,.key"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) void readFileBytes(chosen).then(setBackup);
            }}
            type="file"
          />
        </label>
      )}
      <label className="block space-y-1">
        <span className={labelClass}>Signed admin certificate (PEM)</span>
        <textarea
          className={`${fieldClass} h-28`}
          onChange={(e) => setCertText(e.target.value)}
          value={certText}
        />
      </label>
      {anchorDer ? null : (
        <label className="block space-y-1">
          <span className={labelClass}>Operator CA certificate for the chain (optional)</span>
          <textarea
            className={`${fieldClass} h-20`}
            onChange={(e) => setChainText(e.target.value)}
            value={chainText}
          />
        </label>
      )}
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
      {result?.warnings.map((w) => (
        <p className="font-mono text-xs text-warning" key={w}>
          {w}
        </p>
      ))}
      {error ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          disabled={!backup || certText.trim() === "" || passphrase === "" || pending}
          onClick={() => void record()}
          size="sm"
        >
          {pending ? "Working…" : "Record and build PKCS#12"}
        </Button>
      </div>
    </div>
  );
};

const pathBRecipe = (email: string): string =>
  [
    "# On your machine: the key and CSR (keep admin.key private)",
    "openssl ecparam -name secp384r1 -genkey -noout -out admin.key",
    `openssl req -new -key admin.key -sha384 -subj "/CN=${email}" -out admin.csr`,
    "# At the CA: sign with the op_admin section",
    "openssl ca -config operator-ca.cnf -extensions op_admin -notext -in admin.csr -out admin.crt",
    "# On your machine: the PKCS#12 to install",
    `openssl pkcs12 -export -inkey admin.key -in admin.crt -certfile operator-ca.crt -name "FleetOS admin (${email})" -out admin.p12`,
  ].join("\n");

// PathB: everything happens at the CA with OpenSSL. The optional pre-flight
// sends only the certificate, so the manager can catch a missing or critical
// level extension before the operator fights the browser's certificate store.
const PathB = ({ adminExtfile, onDone }: { adminExtfile: string; onDone: () => void }) => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [certText, setCertText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [result, setResult] = useState<FirstAdminResult | null>(null);

  const cleanEmail = email.trim().toLowerCase() || "you@example.org";

  const preflight = async () => {
    setPending(true);
    setError(null);
    try {
      setResult(await submitFirstAdminCertificate({ certDer: certFrom(certText), fullName }));
    } catch (error_: unknown) {
      setError(fleetErrorMessage(error_, "The pre-flight failed."));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className={labelClass}>Email (the certificate&apos;s CN)</span>
        <input
          className={fieldClass}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          value={email}
        />
      </label>
      <CopyBlock label="Admin extension section" text={adminExtfile} />
      <CopyBlock label="OpenSSL commands" text={pathBRecipe(cleanEmail)} />
      <p className="text-xs text-muted-foreground">
        Install the PKCS#12 yourself. Your first sign-in with it records the certificate as the
        first admin and closes first run.
      </p>
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-semibold">Optional pre-flight</p>
        <p className="text-xs text-muted-foreground">
          Paste the signed certificate to have the Fleet Manager check it now. Only the certificate
          is sent.
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
          <span className={labelClass}>Signed admin certificate (PEM)</span>
          <textarea
            className={`${fieldClass} h-24`}
            onChange={(e) => setCertText(e.target.value)}
            value={certText}
          />
        </label>
        {error ? (
          <p className="font-mono text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {result ? (
          <p className="text-xs" role="status">
            Recorded {result.email}, serial <span className="font-mono">{result.serialHex}</span>.
            {result.warnings.length > 0 ? ` ${result.warnings.join(" ")}` : ""}
          </p>
        ) : null}
        <Button
          disabled={certText.trim() === "" || fullName.trim() === "" || pending}
          onClick={() => void preflight()}
          size="sm"
          variant="outline"
        >
          Run the pre-flight
        </Button>
      </div>
      <div className="flex justify-end">
        <Button onClick={onDone} size="sm">
          {result ? "Continue to install" : "Skip to install"}
        </Button>
      </div>
    </div>
  );
};

// AdminStep gets the first admin certificate, which the external CA signs.
// The Fleet Manager never signs it.
export const AdminStep = ({
  adminExtfile,
  anchorDer,
  onDone,
}: {
  adminExtfile: string;
  anchorDer: null | Uint8Array;
  onDone: () => void;
}) => {
  const [path, setPath] = useState<"a" | "b">("a");
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className={labelClass}>How to make the certificate</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            checked={path === "a"}
            name="admin-path"
            onChange={() => setPath("a")}
            type="radio"
          />
          <span>
            Path A (recommended): make the key here
            <span className="block text-xs text-muted-foreground">
              This browser makes the key and CSR; your CA signs the CSR; this page builds the
              PKCS#12.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            checked={path === "b"}
            name="admin-path"
            onChange={() => setPath("b")}
            type="radio"
          />
          <span>
            Path B: everything at the CA with OpenSSL
            <span className="block text-xs text-muted-foreground">
              You make the key, certificate and PKCS#12 yourself.
            </span>
          </span>
        </label>
      </fieldset>
      {path === "a" ? (
        <PathA adminExtfile={adminExtfile} anchorDer={anchorDer} onDone={onDone} />
      ) : (
        <PathB adminExtfile={adminExtfile} onDone={onDone} />
      )}
    </div>
  );
};
