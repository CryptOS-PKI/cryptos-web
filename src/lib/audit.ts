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

import { useEffect, useSyncExternalStore } from "react";

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

import type { AuditEvent as ProtoAuditEvent } from "@/gen/fleet/cryptos/fleet/v1/fleet_pb";

// Leaf store: imports NO domain store (domain stores import recordAudit from
// here). Own fixed clock keeps events deterministic without Date.now().
export interface AuditEvent {
  /** Subject CN of the operator certificate that acted, or that the agent key is bound to. */
  actorCn?: string;
  actorKind?: AuditActorKind;
  at: string;
  id: string;
  kind: AuditKind;
  outcome?: string;
  summary: string;
  targetKind?: "cert" | "enrollment" | "mcp-key" | "node" | "profile" | "protocol";
  targetPath?: string;
  /** MCP tool name, when the action came through an agent. */
  tool?: string;
  via?: string;
}

export type AuditActorKind = "cert" | "mcp_key";

export type AuditKind =
  | "config-applied"
  | "enroll-approved"
  | "enroll-rejected"
  | "issued"
  | "mcp-key-created"
  | "mcp-key-first-used"
  | "mcp-key-rejected"
  | "mcp-key-revoked"
  | "profile-applied"
  | "profile-created"
  | "profile-deleted"
  | "profile-updated"
  | "protocol-toggled"
  | "rekeyed"
  | "renewed"
  | "revoked";

const AUDIT_EPOCH_MS = Date.parse("2026-07-01T00:00:00Z");
const daysFromNow = (days: number): string =>
  new Date(AUDIT_EPOCH_MS + days * 86_400_000).toISOString();

const seed = (): AuditEvent[] => [
  {
    actorCn: "operator@example.org",
    actorKind: "cert",
    at: daysFromNow(-1),
    id: "aud-0009",
    outcome: "ok",
    kind: "revoked",
    summary: "Revoked svc-9.acme.example (keyCompromise)",
    targetKind: "cert",
    via: "web",
  },
  {
    at: daysFromNow(-2),
    id: "aud-0008",
    kind: "enroll-approved",
    summary: "Approved enrollment acme-issuing-03 under ACME Intermediate CA G1",
    targetKind: "node",
    targetPath: "/nodes/acme-issuing-03",
  },
  {
    at: daysFromNow(-3),
    id: "aud-0007",
    kind: "protocol-toggled",
    summary: "Enabled ACME (RFC 8555)",
    targetKind: "protocol",
    targetPath: "/protocols/acme",
  },
  {
    at: daysFromNow(-4),
    id: "aud-0006",
    kind: "config-applied",
    summary: "Config applied to acme-issuing-01",
    targetKind: "node",
    targetPath: "/nodes/acme-issuing-01",
  },
  {
    at: daysFromNow(-5),
    id: "aud-0005",
    kind: "rekeyed",
    summary: "Re-key ceremony completed for acme-root-01",
    targetKind: "node",
    targetPath: "/root/acme-root-01",
  },
  {
    at: daysFromNow(-6),
    id: "aud-0004",
    kind: "renewed",
    summary: "Renewed ldap-a.acme.example",
    targetKind: "cert",
  },
  {
    at: daysFromNow(-7),
    id: "aud-0003",
    kind: "profile-updated",
    summary: "Updated profile Code Signing",
    targetKind: "profile",
    targetPath: "/profiles/Code Signing",
  },
  {
    at: daysFromNow(-8),
    id: "aud-0002",
    kind: "enroll-rejected",
    summary: "Rejected enrollment acme-issuing-h03 (failed attestation)",
    targetKind: "enrollment",
  },
  {
    at: daysFromNow(-9),
    id: "aud-0001",
    kind: "profile-created",
    summary: "Created profile TLS Server (LDAPS)",
    targetKind: "profile",
    targetPath: "/profiles/TLS Server (LDAPS)",
  },
  {
    actorCn: "operator@example.org",
    actorKind: "mcp_key",
    at: daysFromNow(-10),
    id: "aud-0000",
    kind: "issued",
    outcome: "ok",
    summary: "Issued leaf svc-1.acme.example on acme-issuing-01",
    targetKind: "cert",
    tool: "cert_issue_from_csr",
    via: "mcp",
  },
];

let events: AuditEvent[] = seed();
const listeners = new Set<() => void>();
const emit = (): void => {
  for (const l of listeners) l();
};
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const auditList = (): AuditEvent[] => events;

// The live audit log, populated by ListAudit over Connect. A separate store
// from the mock log above: `live`/`live-auth` read this array and never
// touch the mock one, so flipping VITE_FLEET_MODE never mixes the two.
// Mirrors the live-store pattern in lib/nodes.ts.
let liveEvents: AuditEvent[] = [];
const liveListeners = new Set<() => void>();
const emitLive = (): void => {
  for (const l of liveListeners) l();
};
const subscribeLive = (l: () => void): (() => void) => {
  liveListeners.add(l);
  return () => liveListeners.delete(l);
};

const knownAuditKinds = new Set<AuditKind>([
  "config-applied",
  "enroll-approved",
  "enroll-rejected",
  "issued",
  "mcp-key-created",
  "mcp-key-first-used",
  "mcp-key-rejected",
  "mcp-key-revoked",
  "profile-applied",
  "profile-created",
  "profile-deleted",
  "profile-updated",
  "protocol-toggled",
  "rekeyed",
  "renewed",
  "revoked",
]);
const knownTargetKinds = new Set<NonNullable<AuditEvent["targetKind"]>>([
  "cert",
  "enrollment",
  "mcp-key",
  "node",
  "profile",
  "protocol",
]);

// AuditEvent (proto) -> the web AuditEvent shape. kind is narrowed to the
// known AuditKind union, falling back to "config-applied" (a benign,
// non-destructive-sounding kind) for an unrecognized value.
// The actor fields are empty on entries recorded before the manager captured an
// actor, and they map to undefined so the table renders them as unknown.
const fromProtoEvent = (event: ProtoAuditEvent): AuditEvent => ({
  actorCn: event.actorCn || undefined,
  actorKind:
    event.actorKind === "cert" || event.actorKind === "mcp_key" ? event.actorKind : undefined,
  at: event.at,
  id: event.id,
  kind: knownAuditKinds.has(event.kind as AuditKind) ? (event.kind as AuditKind) : "config-applied",
  outcome: event.outcome || undefined,
  summary: event.summary,
  targetKind: knownTargetKinds.has(event.targetKind as NonNullable<AuditEvent["targetKind"]>)
    ? (event.targetKind as NonNullable<AuditEvent["targetKind"]>)
    : undefined,
  targetPath: event.targetPath || undefined,
  tool: event.tool || undefined,
  via: event.via || undefined,
});

const AUDIT_POLL_INTERVAL_MS = 10_000;

// Fetches ListAudit once and (for `live`/`live-auth`) keeps polling on an
// interval so a newly recorded event is picked up without a reload. Errors
// are swallowed to a console warning: a manager outage should degrade the
// audit view to whatever it last had, not throw the page into an error
// boundary.
const refreshLiveAudit = async (): Promise<void> => {
  try {
    const response = await fleetClient().listAudit({});
    liveEvents = response.items.map(fromProtoEvent);
    emitLive();
  } catch (error) {
    // eslint-disable-next-line no-console -- surfaced for local live debugging
    console.warn("fleet: ListAudit failed", error);
  }
};

export const useAudit = (): AuditEvent[] => {
  const mode = fleetMode();

  useEffect(() => {
    if (mode === "mock") return;
    void refreshLiveAudit();
    const interval = setInterval(() => void refreshLiveAudit(), AUDIT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode]);

  return useSyncExternalStore(
    mode === "mock" ? subscribe : subscribeLive,
    () => (mode === "mock" ? events : liveEvents),
    () => (mode === "mock" ? events : liveEvents),
  );
};

let nextId = 1000;
export const recordAudit = (e: Omit<AuditEvent, "at" | "id">): void => {
  events = [{ ...e, at: daysFromNow(0), id: `aud-${nextId++}` }, ...events];
  emit();
};

// Test-only.
export const __resetAudit = (): void => {
  events = seed();
  nextId = 1000;
  emit();
};
