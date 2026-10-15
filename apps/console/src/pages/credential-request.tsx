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
import {
  Button,
  CopyBlock,
  Field,
  Input,
  inputClasses,
  KeyBackupStep,
  Notice,
  Wordmark,
} from "@cryptos-pki/ui";
import { X509Certificate } from "@peculiar/x509";
import { useEffect, useState } from "react";

import {
  buildCredentialPkcs12,
  generateBackupPassphrase,
  keyBackupFilename,
  keyBackupPem,
  readCertificateDer,
} from "@/lib/crypto/key-backup";
import { generateLeafKeyAndCSR } from "@/lib/crypto/leaf-key";
import { downloadBytes, downloadText, readFileBytes } from "@/lib/download";
import { looksLikeEmail } from "@/lib/form";
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

interface MadeRequestKey {
  backupPem: string;
  csrDer: Uint8Array;
  passphrase: string;
}

// useMadeRequestKey makes the holder's P-384 key and CSR in the browser once
// the form asks for one, the same pattern CredentialRequestWizard uses for
// its own in-browser key, then makes the encrypted key backup.
const useMadeRequestKey = (active: boolean, email: string, level: OperatorLevel) => {
  const [made, setMade] = useState<MadeRequestKey | null>(null);
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

const MakeRequest = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<OperatorLevel>("operator");
  const [making, setMaking] = useState(false);
  const [csrPem, setCsrPem] = useState<null | string>(null);

  const cleanEmail = email.trim().toLowerCase();
  const { error: keyError, made } = useMadeRequestKey(making && !csrPem, cleanEmail, level);

  if (csrPem) {
    return (
      <div className="space-y-3">
        <CopyBlock
          filename={`${credentialFileBase(level, cleanEmail)}.csr`}
          label="CSR"
          onDownload={downloadText}
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
        onContinue={() => setCsrPem(csrToPem(made.csrDer))}
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
              passphrase is shown only here, once; without both, the key is lost and you must start
              again.
            </p>
          </>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Full name">
        <Input onChange={(e) => setFullName(e.target.value)} value={fullName} />
      </Field>
      <Field label="Email (your certificate's CN)">
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
      <Field label="Your key backup file">
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
      <Field label="Your signed certificate (PEM)">
        <textarea
          className={`${inputClasses} h-28`}
          onChange={(e) => setCertText(e.target.value)}
          value={certText}
        />
      </Field>
      <Field label="Operator CA certificate for the chain (optional)">
        <textarea
          className={`${inputClasses} h-20`}
          onChange={(e) => setChainText(e.target.value)}
          value={chainText}
        />
      </Field>
      <Field label="Key backup passphrase">
        <Input
          autoComplete="off"
          onChange={(e) => setPassphrase(e.target.value)}
          type="password"
          value={passphrase}
        />
      </Field>
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
      {done ? (
        <Notice role="status" tone="success">
          PKCS#12 downloaded as <span className="font-mono">{done}</span>. It opens with the same
          passphrase. Import it into your browser or OS certificate store.
        </Notice>
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
    <Wordmark className="text-2xl" markSize={28} product="FleetOS" />
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
