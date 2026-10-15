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

import { OcspSigner } from "@cryptos-pki/api-client/cryptos/fleet/v1/operator_ca_pb";
import { Button, Dialog, Field, Input, Notice } from "@cryptos-pki/ui";
import { useState } from "react";

import {
  CrlSourceFields,
  OcspFields,
  OperatorCARegisterForm,
} from "@/components/operator-ca-register-form";
import { readFileBytes } from "@/lib/download";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import {
  buildCrlChoice,
  type CrlChoice,
  crlChoiceReady,
  type OcspChoice,
  ocspModeLabel,
  type OcspProbeRow,
  type OperatorCARow,
  registerOperatorCA,
  retireOperatorCA,
  setOperatorCACrlSource,
  setOperatorCAOcsp,
  uploadOperatorCrl,
} from "@/lib/operator-cas";

// useAction runs one admin call, keeping the pending flag and the refusal
// message (by reason code) for the dialog.
const useAction = () => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const run = async <T,>(call: () => Promise<T>, fallback: string): Promise<T | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await call();
    } catch (error_: unknown) {
      setError(fleetErrorMessage(error_, fallback));
      return undefined;
    } finally {
      setPending(false);
    }
  };
  return { error, pending, run };
};

const ErrorLine = ({ error }: { error: null | string }) =>
  error ? (
    <Notice role="alert" tone="danger">
      {error}
    </Notice>
  ) : null;

export const RegisterOperatorCADialog = ({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) => (
  <Dialog onClose={onClose} open title="Register operator CA" variant="wide">
    <p className="text-xs text-muted-foreground">
      The new CA becomes active and the current active CA becomes retiring: both are trusted until
      you retire the old one. New credentials are recorded only under the active CA.
    </p>
    <OperatorCARegisterForm
      onRegistered={() => {
        onDone();
        onClose();
      }}
      submit={registerOperatorCA}
    />
  </Dialog>
);

export const RetireOperatorCADialog = ({
  ca,
  onClose,
  onDone,
}: {
  ca: OperatorCARow;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [selfLockout, setSelfLockout] = useState(false);
  const { error, pending, run } = useAction();
  return (
    <Dialog
      description={ca.subject}
      footer={
        <>
          <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              void run(() => retireOperatorCA(ca.sha256, selfLockout), "Retire failed.").then(
                (done) => {
                  if (done) {
                    onDone();
                    onClose();
                  }
                },
              )
            }
            size="sm"
            variant="destructive"
          >
            Retire this CA
          </Button>
        </>
      }
      onClose={onClose}
      open
      title="Retire operator CA"
      variant="destructive"
    >
      <Notice role="note" tone="danger">
        Every certificate under this CA is refused from its next request, including MCP keys bound
        to them. The Fleet Manager refuses to retire the last active CA. If your own certificate
        comes only from this CA, retiring it signs you out for good unless you tick the box below on
        purpose.
      </Notice>
      <label className="flex items-start gap-2 text-xs">
        <input
          checked={selfLockout}
          onChange={(e) => setSelfLockout(e.target.checked)}
          type="checkbox"
        />
        Retire it even if this would lock myself out
      </label>
      <ErrorLine error={error} />
    </Dialog>
  );
};

export const CrlSourceDialog = ({
  ca,
  onClose,
  onDone,
}: {
  ca: OperatorCARow;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [kind, setKind] = useState<CrlChoice["kind"]>("url");
  const [url, setUrl] = useState(ca.crlLocation);
  const [crlFile, setCrlFile] = useState<null | Uint8Array>(null);
  const [ack, setAck] = useState(false);
  const { error, pending, run } = useAction();
  return (
    <Dialog
      description={ca.subject}
      footer={
        <>
          <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={pending || !crlChoiceReady(kind, url, crlFile, ack)}
            onClick={() =>
              void run(
                () => setOperatorCACrlSource(ca.sha256, buildCrlChoice(kind, url, crlFile)),
                "Changing the CRL source failed.",
              ).then((done) => {
                if (done) {
                  onDone();
                  onClose();
                }
              })
            }
            size="sm"
          >
            Save
          </Button>
        </>
      }
      onClose={onClose}
      open
      title="CRL source"
    >
      <p className="text-xs text-muted-foreground">
        A new URL or CRL must verify against the CA before it is saved.
      </p>
      <CrlSourceFields
        ack={ack}
        crlFile={crlFile}
        kind={kind}
        onAck={setAck}
        onCrlFile={setCrlFile}
        onKind={setKind}
        onUrl={setUrl}
        url={url}
      />
      <ErrorLine error={error} />
    </Dialog>
  );
};

export const UploadCrlDialog = ({
  ca,
  onClose,
  onDone,
}: {
  ca: OperatorCARow;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [crlFile, setCrlFile] = useState<null | Uint8Array>(null);
  const { error, pending, run } = useAction();
  return (
    <Dialog
      description={ca.subject}
      footer={
        <>
          <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={pending || !crlFile}
            onClick={() =>
              void run(
                () => uploadOperatorCrl(ca.sha256, crlFile ?? new Uint8Array()),
                "Uploading the CRL failed.",
              ).then((done) => {
                if (done) {
                  onDone();
                  onClose();
                }
              })
            }
            size="sm"
          >
            Upload
          </Button>
        </>
      }
      onClose={onClose}
      open
      title="Upload CRL"
    >
      <p className="text-xs text-muted-foreground">
        The CRL must be signed by this CA and newer than the one the Fleet Manager holds
        {ca.crl?.nextUpdate ? `, whose next update is ${ca.crl.nextUpdate}` : ""}.
      </p>
      <Field label="CRL file (PEM or DER)">
        <Input
          accept=".crl,.pem,.der"
          mono={false}
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen) void readFileBytes(chosen).then(setCrlFile);
          }}
          type="file"
        />
      </Field>
      <ErrorLine error={error} />
    </Dialog>
  );
};

export const OcspDialog = ({
  ca,
  onClose,
  onDone,
}: {
  ca: OperatorCARow;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [mode, setMode] = useState<OcspChoice>(ocspModeLabel(ca.ocspMode) as OcspChoice);
  const [url, setUrl] = useState(ca.ocspUrl);
  const [probe, setProbe] = useState<null | OcspProbeRow>(null);
  const [saved, setSaved] = useState(false);
  const { error, pending, run } = useAction();
  return (
    <Dialog
      description={ca.subject}
      footer={
        saved ? (
          <Button onClick={onClose} size="sm">
            Close
          </Button>
        ) : (
          <>
            <Button disabled={pending} onClick={onClose} size="sm" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={pending || (mode === "url" && url.trim() === "")}
              onClick={() =>
                void run(
                  () => setOperatorCAOcsp(ca.sha256, mode, url),
                  "Changing the OCSP mode failed.",
                ).then((done) => {
                  if (done) {
                    setProbe(done.ocspProbe ?? null);
                    setSaved(true);
                    onDone();
                  }
                })
              }
              size="sm"
            >
              Save
            </Button>
          </>
        )
      }
      onClose={onClose}
      open
      title="OCSP"
    >
      {saved ? (
        <Notice role="status" tone="success">
          <p>OCSP mode saved.</p>
          {probe ? (
            <p>
              The responder answered, signed by{" "}
              {probe.signer === OcspSigner.ANCHOR ? "the CA itself" : "a delegated responder"} (
              {probe.signerSubject}), valid until {probe.signerNotAfter}.
            </p>
          ) : null}
        </Notice>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            OCSP only ever adds revocations. A url responder is probed before it is saved.
          </p>
          <OcspFields mode={mode} onMode={setMode} onUrl={setUrl} url={url} />
          <ErrorLine error={error} />
        </>
      )}
    </Dialog>
  );
};
