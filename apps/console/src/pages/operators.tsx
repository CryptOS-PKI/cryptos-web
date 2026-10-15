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

import { Button, DataTable, type DataTableColumn, EmptyState, Notice } from "@cryptos-pki/ui";
import { useCallback, useEffect, useState } from "react";

import { CredentialCompleteDialog } from "@/components/credential-complete-dialog";
import { CredentialRequestWizard } from "@/components/credential-request-wizard";
import { OperatorCABanners } from "@/components/operator-ca-banners";
import { OperatorDenyDialog } from "@/components/operator-deny-dialog";
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

  const signedInAs = operator ? (
    <>
      You are signed in as <span className="text-foreground">{operator.commonName}</span> (
      {operator.level}), serial <span className="text-foreground">{operator.serial}</span>
    </>
  ) : null;

  const credentialColumns: DataTableColumn<OperatorCredentialRow>[] = [
    {
      cell: (r) => (
        <>
          <span>{r.commonName}</span>
          {r.fullName ? (
            <span className="block font-normal text-muted-foreground">{r.fullName}</span>
          ) : null}
        </>
      ),
      className: "font-semibold",
      header: "Holder",
      id: "commonName",
      mobile: "title",
    },
    { cell: (r) => r.level, header: "Level", id: "level" },
    { cell: (r) => r.kind, header: "Kind", id: "kind" },
    {
      cell: (r) => <span title={r.issuerSha256}>{shortFingerprint(r.issuerSha256)}</span>,
      header: "Issuer",
      id: "issuer",
    },
    { cell: (r) => r.serialHex, className: "break-all", header: "Serial", id: "serial" },
    { cell: (r) => r.notAfter, header: "Expiry", id: "expiry" },
    {
      cell: (r) => (r.denylisted ? <span className="text-destructive">denylisted</span> : "-"),
      header: "Denylisted",
      id: "denylisted",
    },
    {
      cell: (r) => (r.crlRevoked ? <span className="text-destructive">CRL-revoked</span> : "-"),
      header: "CRL",
      id: "crl",
    },
    { cell: (r) => r.lastSeenAt || "-", header: "Last seen", id: "lastSeen" },
    {
      cell: (r) =>
        isAdmin && !r.denylisted && r.kind !== "legacy_node" ? (
          <button className={actionButton} onClick={() => setDenyTarget(r)} type="button">
            {"Deny…"}
          </button>
        ) : null,
      header: <span className="sr-only">Actions</span>,
      id: "actions",
      mobile: "action",
    },
  ];

  const requestColumns: DataTableColumn<CredentialRequestRow>[] = [
    {
      cell: (q) => (
        <>
          <span>{q.email}</span>
          {q.fullName ? (
            <span className="block font-normal text-muted-foreground">{q.fullName}</span>
          ) : null}
        </>
      ),
      className: "font-semibold",
      header: "Holder",
      id: "email",
      mobile: "title",
    },
    { cell: (q) => q.level, header: "Level", id: "level" },
    { cell: (q) => q.createdAt, header: "Requested", id: "createdAt" },
    { cell: (q) => q.createdByCn, header: "By", id: "createdByCn" },
    { cell: (q) => q.expiresAt, header: "Expires", id: "expiresAt" },
    {
      cell: (q) =>
        isAdmin ? (
          <div className="space-x-2 text-right">
            <button className={actionButton} onClick={() => setCompleteTarget(q)} type="button">
              {"Complete…"}
            </button>
            <button className={actionButton} onClick={() => cancel(q)} type="button">
              Cancel
            </button>
          </div>
        ) : null,
      header: <span className="sr-only">Actions</span>,
      id: "actions",
      mobile: "action",
    },
  ];

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

      <Notice className="max-w-3xl" role="note" tone="warning">
        Operator credentials are signed by your external operator CA, never by the Fleet Manager.
        Denying one here stops it at this Fleet Manager from its next request; revoke it at your CA
        as well so other systems stop trusting it.
      </Notice>

      {loadError ? (
        <Notice role="alert" tone="danger">
          {loadError}
        </Notice>
      ) : null}
      {actionError ? (
        <Notice role="alert" tone="danger">
          {actionError}
        </Notice>
      ) : null}

      <div className="flex gap-2" role="tablist">
        {tabButton("credentials", "Credentials")}
        {tabButton("requests", "Pending requests")}
      </div>

      {tab === "credentials" ? (
        <DataTable
          columns={credentialColumns}
          empty={
            caUnconfigured ? (
              <EmptyState
                body={
                  <>
                    The Fleet Manager trusts no operator CA yet. Set{" "}
                    <span className="font-mono">operatorCAPath</span> in its configuration, or
                    register your CA during first run.
                  </>
                }
                footnote={signedInAs}
                title="No operator CA is configured."
              />
            ) : (
              <EmptyState
                body="This lists credentials recorded here and every credential the Fleet Manager has seen sign in, including ones made entirely at your CA."
                footnote={signedInAs}
                title="No operator credentials are recorded or seen yet."
              />
            )
          }
          label="Operator credentials"
          rowKey={(r) => `${r.issuerSha256}/${r.serialHex}`}
          rows={rows}
        />
      ) : (
        <DataTable
          columns={requestColumns}
          empty={<EmptyState title="No pending credential requests." />}
          label="Pending credential requests"
          rowKey={(q) => q.id}
          rows={requests}
        />
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
