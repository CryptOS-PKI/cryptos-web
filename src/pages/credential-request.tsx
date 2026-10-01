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

import "reflect-metadata";
import { X509Certificate } from "@peculiar/x509";
import { useState } from "react";

import { CopyBlock } from "@/components/copy-block";
import { KeyBackupStep } from "@/components/key-backup-step";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import { buildCredentialPkcs12, readCertificateDer } from "@/lib/crypto/key-backup";
import { downloadBytes, readFileBytes } from "@/lib/download";
import { fieldClass, labelClass, looksLikeEmail } from "@/lib/form";
import {
  credentialFileBase,
  csrToPem,
  OPERATOR_LEVEL_OID,
  OPERATOR_LEVELS,
  type OperatorLevel,
} from "@/lib/operators";

// The anonymous "Make a credential request" page. A future operator makes
// their own key, encrypted key backup and CSR here, sends the CSR to a Fleet
// Manager admin, and later builds their PKCS#12 from the backup and the
// signed certificate. Everything happens in this browser: the page makes no
// network calls at all, so it doesn't import the Fleet Manager client.

const certIdentity = (certDer: Uint8Array): { email: string; level: string } => {
  const cert = new X509Certificate(new Uint8Array(certDer));
  const email = cert.subjectName.getField("CN")[0] ?? "operator";
  const ext = cert.getExtension(OPERATOR_LEVEL_OID);
  const value = ext ? new Uint8Array(ext.value) : new Uint8Array();
  const level = value[0] === 0x13 ? new TextDecoder().decode(value.subarray(2)) : "operator";
  return { email, level };
};

const MakeRequest = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<OperatorLevel>("operator");
  const [making, setMaking] = useState(false);
  const [csrPem, setCsrPem] = useState<null | string>(null);

  const cleanEmail = email.trim().toLowerCase();

  if (csrPem) {
    return (
      <div className="space-y-3">
        <CopyBlock
          filename={`${credentialFileBase(level, cleanEmail)}.csr`}
          label="CSR"
          text={csrPem}
        />
        <p className="text-sm text-muted-foreground">
          Send this CSR, and nothing else, to a Fleet Manager admin with your name ({fullName}) and
          the level you need ({level}). Keep the key backup and its passphrase to yourself. When the
          signed certificate comes back, build your PKCS#12 below.
        </p>
      </div>
    );
  }

  if (making) {
    return (
      <KeyBackupStep
        email={cleanEmail}
        level={level}
        onBackedUp={({ csrDer }) => setCsrPem(csrToPem(csrDer))}
      />
    );
  }

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
        <span className={labelClass}>Email (your certificate&apos;s CN)</span>
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
      <div className="flex justify-end">
        <Button
          disabled={fullName.trim() === "" || !looksLikeEmail(email)}
          onClick={() => setMaking(true)}
          size="sm"
        >
          Make my key and CSR
        </Button>
      </div>
    </div>
  );
};

const BuildPkcs12 = () => {
  const [backup, setBackup] = useState<null | Uint8Array>(null);
  const [certText, setCertText] = useState("");
  const [chainText, setChainText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [done, setDone] = useState("");

  const build = async () => {
    setPending(true);
    setError(null);
    try {
      const certDer = readCertificateDer(new TextEncoder().encode(certText.trim()));
      const chainDer =
        chainText.trim() === ""
          ? []
          : [readCertificateDer(new TextEncoder().encode(chainText.trim()))];
      const { email, level } = certIdentity(certDer);
      const pfx = await buildCredentialPkcs12({
        backup: backup ?? new Uint8Array(),
        certDer,
        chainDer,
        friendlyName: `FleetOS ${level} (${email})`,
        passphrase,
      });
      const name = `${email}.p12`;
      downloadBytes(name, pfx, "application/x-pkcs12");
      setPassphrase("");
      setDone(name);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "Building the PKCS#12 failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-xs">
        <span className={`${labelClass} block`}>Your key backup file</span>
        <input
          accept=".pem,.key"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen) void readFileBytes(chosen).then(setBackup);
          }}
          type="file"
        />
      </label>
      <label className="block space-y-1">
        <span className={labelClass}>Your signed certificate (PEM)</span>
        <textarea
          className={`${fieldClass} h-28`}
          onChange={(e) => setCertText(e.target.value)}
          value={certText}
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
      {error ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="text-xs text-muted-foreground" role="status">
          PKCS#12 downloaded as <span className="font-mono">{done}</span>. It opens with the same
          passphrase. Import it into your browser or OS certificate store.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          disabled={!backup || certText.trim() === "" || passphrase === "" || pending}
          onClick={() => void build()}
          size="sm"
        >
          {pending ? "Building…" : "Build my PKCS#12"}
        </Button>
      </div>
    </div>
  );
};

export const CredentialRequestPage = () => (
  <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-background px-6 py-10">
    <Wordmark className="text-2xl" />
    <div className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">Make a credential request</h1>
      <p className="text-sm text-muted-foreground">
        Make your own Fleet Manager operator key and certificate signing request in this browser.
        Nothing on this page is sent anywhere: the key, its backup and the passphrase stay on your
        machine, and only the CSR is for your admin.
      </p>
    </div>
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-bold">1. Make your key and CSR</h2>
      <MakeRequest />
    </section>
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-bold">2. Build your PKCS#12</h2>
      <p className="text-sm text-muted-foreground">
        When your admin sends back the signed certificate, combine it with your key backup here.
      </p>
      <BuildPkcs12 />
    </section>
    <a className="text-sm text-primary underline" href="/">
      Back to sign-in
    </a>
  </main>
);
