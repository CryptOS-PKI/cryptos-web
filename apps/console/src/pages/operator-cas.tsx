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
  CrlSource,
  OperatorCAState,
} from "@cryptos-pki/api-client/cryptos/fleet/v1/operator_ca_pb";
import { useCallback, useEffect, useState } from "react";

import { OperatorCABanners } from "@/components/operator-ca-banners";
import {
  CrlSourceDialog,
  OcspDialog,
  RegisterOperatorCADialog,
  RetireOperatorCADialog,
  UploadCrlDialog,
} from "@/components/operator-ca-dialogs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { shortFingerprint } from "@/lib/fingerprint";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import {
  crlSourceLabel,
  listOperatorCAs,
  ocspModeLabel,
  operatorCABanners,
  type OperatorCARow,
  stateLabel,
} from "@/lib/operator-cas";

const th =
  "px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground";
const td = "px-3 py-2 align-top font-mono text-xs";
const actionButton = "rounded-md border px-2.5 py-1 text-xs hover:bg-secondary";

type Dialog =
  { ca: OperatorCARow; kind: "crl" | "ocsp" | "retire" | "upload" } | { kind: "register" } | null;

// OperatorCAsPage lists the external operator CAs the Fleet Manager trusts or
// has trusted, with their CRL and OCSP state, and the banners an admin must
// act on. Admins register a new CA (it becomes active and the old one
// retiring), retire one, and change its CRL source or OCSP mode. A CA from
// the config file is read-only here; the manager refuses changes with 1607.
export const OperatorCAsPage = () => {
  const { operator } = useAuth();
  const isAdmin = operator?.level === "admin";
  const [rows, setRows] = useState<OperatorCARow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setRows(await listOperatorCAs());
    } catch (error_: unknown) {
      console.warn("fleet: ListOperatorCAs failed", error_);
      setLoadError(fleetErrorMessage(error_, "Failed to load operator CAs"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fromConfig = rows.some((r) => r.managedByConfig);
  const close = () => setDialog(null);
  const done = () => void load();

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Operator CAs</h1>
          <p className="text-sm text-muted-foreground">
            The external CAs whose certificates can sign in. The Fleet Manager holds only their
            certificates.
          </p>
        </div>
        {isAdmin && !fromConfig ? (
          <Button onClick={() => setDialog({ kind: "register" })} size="sm">
            {"Register operator CA…"}
          </Button>
        ) : null}
      </div>

      <OperatorCABanners banners={operatorCABanners(rows)} />

      {fromConfig ? (
        <p className="max-w-3xl rounded-md border p-3 text-sm text-muted-foreground" role="note">
          The operator CA comes from the Fleet Manager&apos;s config file (operatorCAPath). Change
          it, its CRLs (operatorCRL) and OCSP (operatorOCSP) in the config.
        </p>
      ) : null}

      {loadError ? (
        <p className="font-mono text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="w-full overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse">
          <thead className="border-b bg-secondary/50">
            <tr>
              <th className={th}>CA</th>
              <th className={th}>State</th>
              <th className={th}>Fingerprint</th>
              <th className={th}>Not after</th>
              <th className={th}>CRL</th>
              <th className={th}>OCSP</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={7}>
                  No operator CA is registered.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const retired = r.state === OperatorCAState.OPERATOR_CA_STATE_RETIRED;
                const actions = isAdmin && !r.managedByConfig && !retired;
                return (
                  <tr className="border-b last:border-0" key={r.sha256}>
                    <td className={`${td} font-semibold`}>
                      <span>{r.subject}</span>
                      {r.warnings.map((w) => (
                        <span className="block font-normal text-warning" key={w}>
                          {w}
                        </span>
                      ))}
                      {r.managedByConfig ? (
                        <span className="block font-normal text-muted-foreground">
                          from the config file
                        </span>
                      ) : null}
                    </td>
                    <td className={td}>{stateLabel(r.state)}</td>
                    <td className={td} title={r.sha256}>
                      {shortFingerprint(r.sha256)}
                    </td>
                    <td className={td}>{r.notAfter}</td>
                    <td className={td}>
                      <span>{crlSourceLabel(r.crlSource)}</span>
                      {r.crlLocation ? (
                        <span className="block break-all text-muted-foreground">
                          {r.crlLocation}
                        </span>
                      ) : null}
                      {r.crl ? (
                        <span
                          className={`block ${r.crl.stale ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          next update {r.crl.nextUpdate}
                          {r.crl.stale ? " (expired)" : ""}
                        </span>
                      ) : null}
                      {r.crl?.lastError ? (
                        <span className="block text-destructive">{r.crl.lastError}</span>
                      ) : null}
                    </td>
                    <td className={td}>
                      <span>{ocspModeLabel(r.ocspMode)}</span>
                      {r.ocspUrl ? (
                        <span className="block break-all text-muted-foreground">{r.ocspUrl}</span>
                      ) : null}
                      {r.ocspLastError ? (
                        <span className="block text-destructive">{r.ocspLastError}</span>
                      ) : null}
                    </td>
                    <td className={`${td} space-y-1 text-right`}>
                      {actions ? (
                        <>
                          <button
                            className={actionButton}
                            onClick={() => setDialog({ ca: r, kind: "crl" })}
                            type="button"
                          >
                            {"CRL source…"}
                          </button>
                          {r.crlSource === CrlSource.UPLOAD ? (
                            <button
                              className={actionButton}
                              onClick={() => setDialog({ ca: r, kind: "upload" })}
                              type="button"
                            >
                              {"Upload CRL…"}
                            </button>
                          ) : null}
                          <button
                            className={actionButton}
                            onClick={() => setDialog({ ca: r, kind: "ocsp" })}
                            type="button"
                          >
                            {"OCSP…"}
                          </button>
                          <button
                            className={actionButton}
                            onClick={() => setDialog({ ca: r, kind: "retire" })}
                            type="button"
                          >
                            {"Retire…"}
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {dialog?.kind === "register" ? (
        <RegisterOperatorCADialog onClose={close} onDone={done} />
      ) : null}
      {dialog?.kind === "retire" ? (
        <RetireOperatorCADialog ca={dialog.ca} onClose={close} onDone={done} />
      ) : null}
      {dialog?.kind === "crl" ? (
        <CrlSourceDialog ca={dialog.ca} onClose={close} onDone={done} />
      ) : null}
      {dialog?.kind === "upload" ? (
        <UploadCrlDialog ca={dialog.ca} onClose={close} onDone={done} />
      ) : null}
      {dialog?.kind === "ocsp" ? <OcspDialog ca={dialog.ca} onClose={close} onDone={done} /> : null}
    </section>
  );
};
