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
  Field,
  Input,
  inputClasses,
  KeyBackupStep,
  Notice,
} from "@cryptos-pki/ui";
import { useEffect, useState } from "react";

import { type FirstAdminResult, submitFirstAdminCertificate } from "@/lib/bootstrap";
import {
  buildCredentialPkcs12,
  generateBackupPassphrase,
  keyBackupFilename,
  keyBackupPem,
  keyMatchesCertificate,
  readCertificateDer,
  readKeyBackup,
} from "@/lib/crypto/key-backup";
import { generateLeafKeyAndCSR } from "@/lib/crypto/leaf-key";
import { downloadBytes, downloadText, readFileBytes } from "@/lib/download";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { looksLikeEmail } from "@/lib/form";
import { credentialFileBase, csrToPem, levelOpensslCommand } from "@/lib/operators";

const legendClass = "font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground";

const SessionCaution = () => (
  <Notice tone="warning">
    The first-run session ends after 15 minutes without a call. If it ends while you are at the CA,
    start again with the newest token from the log, confirm the CA&apos;s fingerprint again, and
    continue from your key backup.
  </Notice>
);

interface MadeAdminKey {
  backupPem: string;
  csrDer: Uint8Array;
  passphrase: string;
}

// useMadeAdminKey makes a P-384 admin key and CSR in the browser once PathA
// reaches the backup step (the same pattern CredentialRequestWizard uses for
// its own in-browser key), then makes the encrypted key backup.
const useMadeAdminKey = (active: boolean, email: string) => {
  const [made, setMade] = useState<MadeAdminKey | null>(null);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        const { csrDer, privateKey } = await generateLeafKeyAndCSR({
          extensionRequest: { level: "admin" },
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
  const { error: keyError, made } = useMadeAdminKey(mode === "make" && !csrDer, cleanEmail);

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
        filename={keyBackupFilename("admin", cleanEmail)}
        onContinue={() => {
          setBackup(new TextEncoder().encode(made.backupPem));
          setCsrDer(made.csrDer);
        }}
        onDownload={() =>
          downloadText(
            keyBackupFilename("admin", cleanEmail),
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
              passphrase is shown only here, once; without both, the key is lost and the request has
              to start again.
            </p>
          </>
        }
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
            onDownload={downloadText}
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
        <Field label="Key backup file">
          <Input
            accept=".pem,.key"
            mono={false}
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) void readFileBytes(chosen).then(setBackup);
            }}
            type="file"
          />
        </Field>
      )}
      <Field label="Signed admin certificate (PEM)">
        <textarea
          className={`${inputClasses} h-28`}
          onChange={(e) => setCertText(e.target.value)}
          value={certText}
        />
      </Field>
      {anchorDer ? null : (
        <Field label="Operator CA certificate for the chain (optional)">
          <textarea
            className={`${inputClasses} h-20`}
            onChange={(e) => setChainText(e.target.value)}
            value={chainText}
          />
        </Field>
      )}
      <Field label="Key backup passphrase">
        <Input
          autoComplete="off"
          onChange={(e) => setPassphrase(e.target.value)}
          type="password"
          value={passphrase}
        />
      </Field>
      {result?.warnings.map((w) => (
        <Notice key={w} tone="warning">
          {w}
        </Notice>
      ))}
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
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
      <Field label="Email (the certificate's CN)">
        <Input onChange={(e) => setEmail(e.target.value)} type="email" value={email} />
      </Field>
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
        <Field label="Full name">
          <Input onChange={(e) => setFullName(e.target.value)} value={fullName} />
        </Field>
        <Field label="Signed admin certificate (PEM)">
          <textarea
            className={`${inputClasses} h-24`}
            onChange={(e) => setCertText(e.target.value)}
            value={certText}
          />
        </Field>
        {error ? (
          <Notice role="alert" tone="danger">
            {error}
          </Notice>
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
        <legend className={legendClass}>How to make the certificate</legend>
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
