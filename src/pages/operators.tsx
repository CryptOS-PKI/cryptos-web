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

import { useCallback, useEffect, useState } from "react";

import { CredentialCompleteDialog } from "@/components/credential-complete-dialog";
import { CredentialRequestWizard } from "@/components/credential-request-wizard";
import { OperatorCABanners } from "@/components/operator-ca-banners";
import { OperatorDenyDialog } from "@/components/operator-deny-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { shortFingerprint } from "@/lib/fingerprint";
import { ErrorCode, errorCode } from "@/lib/fleet/error-code";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { listOperatorCAs, type OperatorCABanner, operatorCABanners } from "@/lib/operator-cas";
import {
  cancelCredentialRequest,
  type CredentialRequestRow,
  listCredentialRequests,
  listOperatorCredentials,
  type OperatorCredentialRow,
} from "@/lib/operators";

const th =
  "px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground";
const td = "px-3 py-2 font-mono text-xs";
const actionButton = "rounded-md border px-2.5 py-1 text-xs hover:bg-secondary";

type Tab = "credentials" | "requests";

// OperatorsPage lists every operator credential the manager knows (recorded,
// requested, first admin, observed in use, legacy) and the pending credential
// requests. The external operator CA signs; the Fleet Manager records and can
// deny. Reads are operator-level; request, record, complete, cancel and deny
// are admin-only here, and the server enforces the same gate.
export const OperatorsPage = () => {
  const { operator } = useAuth();
  const isAdmin = operator?.level === "admin";

  const [tab, setTab] = useState<Tab>("credentials");
  const [rows, setRows] = useState<OperatorCredentialRow[]>([]);
  const [requests, setRequests] = useState<CredentialRequestRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [caUnconfigured, setCaUnconfigured] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<CredentialRequestRow | null | undefined>();
  const [denyTarget, setDenyTarget] = useState<null | OperatorCredentialRow>(null);
  // Encrypted key backups made in this tab, by request id, so Complete can
  // build the PKCS#12 without the file. They go when the page does.
  const [heldBackups, setHeldBackups] = useState<Map<string, Uint8Array>>(new Map());

  const load = useCallback(async () => {
    setLoadError("");
    setCaUnconfigured(false);
    try {
      setRows(await listOperatorCredentials());
    } catch (error_: unknown) {
      if (errorCode(error_) === ErrorCode.OperatorCAUnconfigured) {
        console.info("fleet: ListOperatorCredentials: no operator CA configured");
        setRows([]);
        setCaUnconfigured(true);
        return;
      }
      console.warn("fleet: ListOperatorCredentials failed", error_);
      setLoadError(error_ instanceof Error ? error_.message : "Failed to load credentials");
      return;
    }
    try {
      setRequests(await listCredentialRequests());
    } catch (error_: unknown) {
      console.warn("fleet: ListOperatorCredentialRequests failed", error_);
      setLoadError(fleetErrorMessage(error_, "Failed to load credential requests"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Admins see the operator CA banners here too: a CA whose revocations the
  // Fleet Manager can't see matters most where credentials are denied.
  const [banners, setBanners] = useState<OperatorCABanner[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    listOperatorCAs()
      .then((cas) => setBanners(operatorCABanners(cas)))
      .catch((error_: unknown) =>
        console.info("fleet: ListOperatorCAs for banners failed", error_),
      );
  }, [isAdmin]);

  const cancel = (request: CredentialRequestRow) => {
    setActionError("");
    cancelCredentialRequest(request.id)
      .then(() => load())
      .catch((error_: unknown) => setActionError(fleetErrorMessage(error_, "Cancel failed.")));
  };

  const signedInAs = operator ? (
    <p className="mx-auto mt-2 max-w-xl font-mono text-xs">
      You are signed in as <span className="text-foreground">{operator.commonName}</span> (
      {operator.level}), serial <span className="text-foreground">{operator.serial}</span>
    </p>
  ) : null;

  const tabButton = (id: Tab, label: string) => (
    <button
      aria-selected={tab === id}
      className={`rounded-md px-3 py-1.5 text-sm ${tab === id ? "bg-secondary font-semibold" : "text-muted-foreground hover:bg-secondary/50"}`}
      onClick={() => setTab(id)}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Operators</h1>
          <p className="text-sm text-muted-foreground">
            {rows.filter((r) => !r.revoked).length} usable of {rows.length} operator credentials
            &middot; {requests.length} pending requests
          </p>
        </div>
        {isAdmin && !caUnconfigured ? (
          <div className="flex gap-2">
            <Button onClick={() => setCompleteTarget(null)} size="sm" variant="outline">
              {"Record certificate…"}
            </Button>
            <Button onClick={() => setShowRequest(true)} size="sm">
              {"Request credential…"}
            </Button>
          </div>
        ) : null}
      </div>

      <OperatorCABanners banners={banners} />

      <p
        className="max-w-3xl rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground"
        role="note"
      >
        Operator credentials are signed by your external operator CA, never by the Fleet Manager.
        Denying one here stops it at this Fleet Manager from its next request; revoke it at your CA
        as well so other systems stop trusting it.
      </p>

      {loadError ? (
        <p className="font-mono text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}
      {actionError ? (
        <p className="font-mono text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="flex gap-2" role="tablist">
        {tabButton("credentials", "Credentials")}
        {tabButton("requests", "Pending requests")}
      </div>

      {tab === "credentials" ? (
        <div className="w-full overflow-x-auto rounded-xl border bg-card">
          <table className="w-full border-collapse">
            <thead className="border-b bg-secondary/50">
              <tr>
                <th className={th}>Holder</th>
                <th className={th}>Level</th>
                <th className={th}>Kind</th>
                <th className={th}>Issuer</th>
                <th className={th}>Serial</th>
                <th className={th}>Expiry</th>
                <th className={th}>Denylisted</th>
                <th className={th}>CRL</th>
                <th className={th}>Last seen</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {caUnconfigured ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={10}>
                    <p className="text-foreground">No operator CA is configured.</p>
                    <p className="mx-auto mt-1 max-w-xl">
                      The Fleet Manager trusts no operator CA yet. Set{" "}
                      <span className="font-mono">operatorCAPath</span> in its configuration, or
                      register your CA during first run.
                    </p>
                    {signedInAs}
                  </td>
                </tr>
              ) : null}
              {rows.length === 0 && !caUnconfigured ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={10}>
                    <p className="text-foreground">
                      No operator credentials are recorded or seen yet.
                    </p>
                    <p className="mx-auto mt-1 max-w-xl">
                      This lists credentials recorded here and every credential the Fleet Manager
                      has seen sign in, including ones made entirely at your CA.
                    </p>
                    {signedInAs}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr className="border-b last:border-0" key={`${r.issuerSha256}/${r.serialHex}`}>
                    <td className={`${td} font-semibold`}>
                      <span>{r.commonName}</span>
                      {r.fullName ? (
                        <span className="block font-normal text-muted-foreground">
                          {r.fullName}
                        </span>
                      ) : null}
                    </td>
                    <td className={td}>{r.level}</td>
                    <td className={td}>{r.kind}</td>
                    <td className={td} title={r.issuerSha256}>
                      {shortFingerprint(r.issuerSha256)}
                    </td>
                    <td className={`${td} break-all`}>{r.serialHex}</td>
                    <td className={td}>{r.notAfter}</td>
                    <td className={td}>
                      {r.denylisted ? <span className="text-destructive">denylisted</span> : "-"}
                    </td>
                    <td className={td}>
                      {r.crlRevoked ? <span className="text-destructive">CRL-revoked</span> : "-"}
                    </td>
                    <td className={td}>{r.lastSeenAt || "-"}</td>
                    <td className={`${td} text-right`}>
                      {isAdmin && !r.denylisted && r.kind !== "legacy_node" ? (
                        <button
                          className={actionButton}
                          onClick={() => setDenyTarget(r)}
                          type="button"
                        >
                          {"Deny…"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border bg-card">
          <table className="w-full border-collapse">
            <thead className="border-b bg-secondary/50">
              <tr>
                <th className={th}>Holder</th>
                <th className={th}>Level</th>
                <th className={th}>Requested</th>
                <th className={th}>By</th>
                <th className={th}>Expires</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={6}>
                    No pending credential requests.
                  </td>
                </tr>
              ) : (
                requests.map((q) => (
                  <tr className="border-b last:border-0" key={q.id}>
                    <td className={`${td} font-semibold`}>
                      <span>{q.email}</span>
                      {q.fullName ? (
                        <span className="block font-normal text-muted-foreground">
                          {q.fullName}
                        </span>
                      ) : null}
                    </td>
                    <td className={td}>{q.level}</td>
                    <td className={td}>{q.createdAt}</td>
                    <td className={td}>{q.createdByCn}</td>
                    <td className={td}>{q.expiresAt}</td>
                    <td className={`${td} space-x-2 text-right`}>
                      {isAdmin ? (
                        <>
                          <button
                            className={actionButton}
                            onClick={() => setCompleteTarget(q)}
                            type="button"
                          >
                            {"Complete…"}
                          </button>
                          <button className={actionButton} onClick={() => cancel(q)} type="button">
                            Cancel
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showRequest ? (
        <CredentialRequestWizard
          onClose={() => setShowRequest(false)}
          onCreated={(requestId, backup) => {
            if (backup) setHeldBackups((m) => new Map(m).set(requestId, backup));
            void load();
          }}
        />
      ) : null}
      {completeTarget === undefined ? null : (
        <CredentialCompleteDialog
          heldBackup={completeTarget ? heldBackups.get(completeTarget.id) : undefined}
          onClose={() => setCompleteTarget(undefined)}
          onRecorded={() => {
            if (completeTarget) {
              setHeldBackups((m) => {
                const next = new Map(m);
                next.delete(completeTarget.id);
                return next;
              });
            }
            void load();
          }}
          request={completeTarget}
        />
      )}
      {denyTarget ? (
        <OperatorDenyDialog
          credential={denyTarget}
          onClose={() => setDenyTarget(null)}
          onDenied={() => void load()}
        />
      ) : null}
    </section>
  );
};
