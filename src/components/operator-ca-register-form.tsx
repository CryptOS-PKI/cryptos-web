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

import { Button } from "@/components/ui/button";
import { OcspSigner } from "@/gen/fleet/cryptos/fleet/v1/operator_ca_pb";
import { readFileBytes } from "@/lib/download";
import { colonFingerprint, normalizeFingerprint } from "@/lib/fingerprint";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { fieldClass, labelClass } from "@/lib/form";
import {
  buildCrlChoice,
  type CrlChoice,
  crlChoiceReady,
  type OcspChoice,
  type RegisterForm,
  type RegisterResult,
} from "@/lib/operator-cas";

type CrlKind = CrlChoice["kind"];

export const NO_CRL_NOTICE =
  "Revocations you make at your CA won't be seen by the Fleet Manager. Revoke operators in the Fleet Manager as well (its denylist is always enforced). MCP is unavailable for certificates under a CA without a CRL.";

// CrlSourceFields picks how the Fleet Manager gets the CA's CRL: a URL it
// fetches, an uploaded file, or none (which needs the NO_CRL acknowledgement).
export const CrlSourceFields = ({
  ack,
  crlFile,
  kind,
  onAck,
  onCrlFile,
  onKind,
  onUrl,
  url,
}: {
  ack: boolean;
  crlFile: null | Uint8Array;
  kind: CrlKind;
  onAck: (v: boolean) => void;
  onCrlFile: (v: Uint8Array) => void;
  onKind: (v: CrlKind) => void;
  onUrl: (v: string) => void;
  url: string;
}) => (
  <fieldset className="space-y-2">
    <legend className={labelClass}>CRL source</legend>
    {(
      [
        ["url", "URL", "The Fleet Manager fetches the CA's CRL from an http or https URL."],
        ["upload", "Upload", "You upload each new CRL. Suits a fully offline CA."],
        ["none", "No CRL", "Only the Fleet Manager denylist is enforced."],
      ] as const
    ).map(([value, title, hint]) => (
      <label className="flex items-start gap-2 text-sm" key={value}>
        <input
          checked={kind === value}
          name="crl-source"
          onChange={() => onKind(value)}
          type="radio"
        />
        <span>
          {title}
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
      </label>
    ))}
    {kind === "url" ? (
      <label className="block space-y-1">
        <span className={labelClass}>CRL URL</span>
        <input
          className={fieldClass}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="http://pki.example.org/fleetos-operator.crl"
          value={url}
        />
      </label>
    ) : null}
    {kind === "upload" ? (
      <label className="block space-y-1 text-xs">
        <span className={`${labelClass} block`}>CRL file (PEM or DER)</span>
        <input
          accept=".crl,.pem,.der"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen) void readFileBytes(chosen).then(onCrlFile);
          }}
          type="file"
        />
        {crlFile ? <span className="font-mono">{crlFile.length} bytes</span> : null}
      </label>
    ) : null}
    {kind === "none" ? (
      <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3" role="note">
        <p className="text-xs text-muted-foreground">{NO_CRL_NOTICE}</p>
        <label className="flex items-start gap-2 text-xs">
          <input checked={ack} onChange={(e) => onAck(e.target.checked)} type="checkbox" />I
          understand revocations made at the CA won&apos;t be seen, and MCP is refused under this CA
        </label>
      </div>
    ) : null}
  </fieldset>
);

// OcspFields picks the OCSP mode: aia (the default) reads the responder from
// each certificate, url names one, off checks none.
export const OcspFields = ({
  mode,
  onMode,
  onUrl,
  url,
}: {
  mode: OcspChoice;
  onMode: (v: OcspChoice) => void;
  onUrl: (v: string) => void;
  url: string;
}) => (
  <div className="space-y-2">
    <label className="block space-y-1">
      <span className={labelClass}>OCSP mode</span>
      <select
        className={fieldClass}
        onChange={(e) => onMode(e.target.value as OcspChoice)}
        value={mode}
      >
        <option value="aia">aia: the responder named in each certificate</option>
        <option value="url">url: a responder you name</option>
        <option value="off">off: no OCSP</option>
      </select>
    </label>
    {mode === "url" ? (
      <label className="block space-y-1">
        <span className={labelClass}>Responder URL</span>
        <input
          className={fieldClass}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="http://ocsp.example.org/"
          value={url}
        />
      </label>
    ) : null}
    {mode === "off" ? null : (
      <p className="text-xs text-muted-foreground">
        CA revocations are seen through OCSP only while the responder answers.
      </p>
    )}
  </div>
);

const signerLabel = (s: OcspSigner): string =>
  s === OcspSigner.ANCHOR ? "the CA itself" : "a delegated responder certificate";

// OperatorCARegisterForm uploads an external operator CA certificate with its
// CRL source and OCSP mode, shows the Fleet Manager's preview, and confirms
// only once the operator has pasted the matching fingerprint from the CA
// machine. submit is the admin RPC after first run, or the bootstrap one.
export const OperatorCARegisterForm = ({
  onRegistered,
  submit,
}: {
  onRegistered: (result: RegisterResult, form: RegisterForm) => void;
  submit: (form: RegisterForm) => Promise<RegisterResult>;
}) => {
  const [caText, setCaText] = useState("");
  const [caFile, setCaFile] = useState<null | Uint8Array>(null);
  const [crlKind, setCrlKind] = useState<CrlKind>("url");
  const [crlUrl, setCrlUrl] = useState("");
  const [crlFile, setCrlFile] = useState<null | Uint8Array>(null);
  const [ack, setAck] = useState(false);
  const [ocspMode, setOcspMode] = useState<OcspChoice>("aia");
  const [ocspUrl, setOcspUrl] = useState("");
  const [preview, setPreview] = useState<null | RegisterResult>(null);
  const [pasted, setPasted] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const caBytes = caFile ?? new TextEncoder().encode(caText.trim());
  const ready =
    caBytes.length > 0 &&
    crlChoiceReady(crlKind, crlUrl, crlFile, ack) &&
    (ocspMode !== "url" || ocspUrl.trim() !== "") &&
    !pending;

  const form = (confirmSha256: string): RegisterForm => ({
    caCertDer: caBytes,
    confirmSha256,
    crl: buildCrlChoice(crlKind, crlUrl, crlFile),
    ocspMode,
    ocspUrl,
  });

  const run = async (confirmSha256: string) => {
    setPending(true);
    setError(null);
    try {
      const sent = form(confirmSha256);
      const result = await submit(sent);
      if (result.confirmed) {
        onRegistered(result, sent);
      } else {
        setPreview(result);
      }
    } catch (error_: unknown) {
      setError(fleetErrorMessage(error_, "Registering the operator CA failed."));
    } finally {
      setPending(false);
    }
  };

  if (preview) {
    const ca = preview.operatorCa;
    const matches = normalizeFingerprint(pasted) === ca.sha256;
    return (
      <div className="space-y-3">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Subject</dt>
          <dd className="font-mono">{ca.subject}</dd>
          <dt className="text-muted-foreground">Issuer</dt>
          <dd className="font-mono">{ca.issuer}</dd>
          <dt className="text-muted-foreground">Not after</dt>
          <dd className="font-mono">{ca.notAfter}</dd>
          <dt className="text-muted-foreground">CRL</dt>
          <dd className="font-mono">
            {ca.crl
              ? `this update ${ca.crl.thisUpdate}, next update ${ca.crl.nextUpdate}, ${ca.crl.revokedCount} revoked`
              : "none"}
          </dd>
          {preview.ocspProbe ? (
            <>
              <dt className="text-muted-foreground">OCSP probe</dt>
              <dd className="font-mono">
                signed by {signerLabel(preview.ocspProbe.signer)} ({preview.ocspProbe.signerSubject}
                ), valid until {preview.ocspProbe.signerNotAfter}
              </dd>
            </>
          ) : null}
        </dl>
        {ca.warnings.map((w) => (
          <p className="font-mono text-xs text-warning" key={w}>
            {w}
          </p>
        ))}
        <div className="space-y-1">
          <span className={labelClass}>SHA-256 fingerprint</span>
          <code className="block break-all rounded-md border bg-secondary/40 p-2 font-mono text-xs">
            {colonFingerprint(ca.sha256)}
          </code>
        </div>
        <div
          className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3"
          role="note"
        >
          <p className="text-xs text-muted-foreground">
            Trusting this CA lets anyone holding its key sign in as an admin. On the CA machine, run{" "}
            <code className="font-mono">
              openssl x509 -in operator-ca.crt -noout -fingerprint -sha256
            </code>{" "}
            and paste the output below. Confirm only if it matches.
          </p>
        </div>
        <label className="block space-y-1">
          <span className={labelClass}>Paste the fingerprint from the CA machine</span>
          <input
            autoComplete="off"
            className={fieldClass}
            onChange={(e) => setPasted(e.target.value)}
            value={pasted}
          />
        </label>
        {pasted !== "" && !matches ? (
          <p className="font-mono text-xs text-destructive">
            That fingerprint doesn&apos;t match. Don&apos;t confirm: check you uploaded the right
            certificate.
          </p>
        ) : null}
        {error ? (
          <p className="font-mono text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={() => setPreview(null)} size="sm" variant="outline">
            Back
          </Button>
          <Button disabled={!matches || pending} onClick={() => void run(ca.sha256)} size="sm">
            {pending ? "Confirming…" : "Confirm and trust this CA"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className={labelClass}>Operator CA certificate (PEM)</span>
        <textarea
          className={`${fieldClass} h-28`}
          onChange={(e) => {
            setCaFile(null);
            setCaText(e.target.value);
          }}
          value={caText}
        />
      </label>
      <label className="block space-y-1 text-xs">
        <span className={`${labelClass} block`}>Or choose the certificate file (PEM or DER)</span>
        <input
          accept=".crt,.pem,.cer,.der"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen) void readFileBytes(chosen).then(setCaFile);
          }}
          type="file"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Upload the CA that directly signs operator certificates, never a CryptOS node&apos;s CA.
      </p>
      <CrlSourceFields
        ack={ack}
        crlFile={crlFile}
        kind={crlKind}
        onAck={setAck}
        onCrlFile={setCrlFile}
        onKind={setCrlKind}
        onUrl={setCrlUrl}
        url={crlUrl}
      />
      <OcspFields mode={ocspMode} onMode={setOcspMode} onUrl={setOcspUrl} url={ocspUrl} />
      {error ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button disabled={!ready} onClick={() => void run("")} size="sm">
          {pending ? "Checking…" : "Check the CA"}
        </Button>
      </div>
    </div>
  );
};
