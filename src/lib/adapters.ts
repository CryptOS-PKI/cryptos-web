/*
Apache License 2.0

Copyright 2026 Shane

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

import { recordAudit } from "@/lib/audit";
import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

import type { EnrollmentAdapter as ProtoEnrollmentAdapter } from "@/gen/fleet/cryptos/fleet/v1/fleet_pb";

// UI-defined config for an enrollment protocol adapter, and deliberately still
// the fleet's *intent* rather than a node's served state.
//
// ACME (RFC 8555) and EST (RFC 7030) are implemented and served by the nodes,
// configured under pki.acme and pki.est. The Fleet Manager cannot read either
// today: MachineConfig carries no acme or est field, so GetNodeConfig does not
// return them (cryptos#205 covers why, and why adding them is not simply a
// matter of widening the proto -- both blocks carry secrets). Until the
// non-secret parts are exposed, this list cannot be reconciled with reality.
//
// SCEP and Windows autoenrollment (XCEP/WSTEP) genuinely are not implemented.
export type AdapterKind = "acme" | "est" | "ms-autoenroll" | "scep";

export interface EnrollmentAdapter {
  challenges?: string[];
  enabled: boolean;
  endpoint: string;
  gpoTemplate?: string;
  kind: AdapterKind;
  name: string;
  profile: string;
}

const seed = (): EnrollmentAdapter[] => [
  {
    challenges: ["http-01", "dns-01"],
    enabled: true,
    endpoint: "https://pki.acme.example/acme/directory",
    kind: "acme",
    name: "ACME (RFC 8555)",
    profile: "TLS Server (LDAPS)",
  },
  {
    enabled: true,
    endpoint: "https://pki.acme.example/adpolicyprovider",
    gpoTemplate: "DomainController",
    kind: "ms-autoenroll",
    name: "Windows Autoenrollment (XCEP/WSTEP)",
    profile: "Domain Controller",
  },
  {
    enabled: false,
    endpoint: "https://pki.acme.example/scep",
    kind: "scep",
    name: "SCEP (RFC 8894)",
    profile: "TLS Client",
  },
  {
    enabled: false,
    endpoint: "https://pki.acme.example/.well-known/est",
    kind: "est",
    name: "EST (RFC 7030)",
    profile: "TLS Client",
  },
];

let adapters: EnrollmentAdapter[] = seed();
const listeners = new Set<() => void>();
const emit = (): void => {
  for (const l of listeners) l();
};
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const adaptersList = (): EnrollmentAdapter[] => adapters;
export const getAdapter = (kind: AdapterKind): EnrollmentAdapter | undefined =>
  adapters.find((a) => a.kind === kind);

// The live adapter catalog, populated by ListAdapters over Connect. A
// separate store from the mock catalog above: `live`/`live-auth` read this
// array and never touch the mock one, so flipping VITE_FLEET_MODE never
// mixes the two. Mirrors the live-store pattern in lib/nodes.ts.
let liveAdapters: EnrollmentAdapter[] = [];
const liveListeners = new Set<() => void>();
const emitLive = (): void => {
  for (const l of liveListeners) l();
};
const subscribeLive = (l: () => void): (() => void) => {
  liveListeners.add(l);
  return () => liveListeners.delete(l);
};

const knownAdapterKinds = new Set<AdapterKind>(["acme", "est", "ms-autoenroll", "scep"]);

// EnrollmentAdapter (proto) -> the web EnrollmentAdapter shape. kind is
// narrowed to the known protocol union, falling back to "acme" (the most
// common adapter) for an unrecognized value rather than widening the type.
const fromProtoAdapter = (adapter: ProtoEnrollmentAdapter): EnrollmentAdapter => ({
  challenges: adapter.challenges.length > 0 ? adapter.challenges : undefined,
  enabled: adapter.enabled,
  endpoint: adapter.endpoint,
  gpoTemplate: adapter.gpoTemplate || undefined,
  kind: knownAdapterKinds.has(adapter.kind as AdapterKind) ? (adapter.kind as AdapterKind) : "acme",
  name: adapter.name,
  profile: adapter.profile,
});

const ADAPTERS_POLL_INTERVAL_MS = 10_000;

// Fetches ListAdapters once and (for `live`/`live-auth`) keeps polling on an
// interval so a toggled/updated adapter is picked up without a reload. Errors
// are swallowed to a console warning: a manager outage should degrade the
// adapters view to whatever it last had, not throw the page into an error
// boundary.
const refreshLiveAdapters = async (): Promise<void> => {
  try {
    const response = await fleetClient().listAdapters({});
    liveAdapters = response.items.map(fromProtoAdapter);
    emitLive();
  } catch (error) {
    // eslint-disable-next-line no-console -- surfaced for local live debugging
    console.warn("fleet: ListAdapters failed", error);
  }
};

export const useAdapters = (): EnrollmentAdapter[] => {
  const mode = fleetMode();

  useEffect(() => {
    if (mode === "mock") return;
    void refreshLiveAdapters();
    const interval = setInterval(() => void refreshLiveAdapters(), ADAPTERS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode]);

  return useSyncExternalStore(
    mode === "mock" ? subscribe : subscribeLive,
    () => (mode === "mock" ? adapters : liveAdapters),
    () => (mode === "mock" ? adapters : liveAdapters),
  );
};

const patch = (kind: AdapterKind, next: Partial<EnrollmentAdapter>): void => {
  adapters = adapters.map((a) => (a.kind === kind ? { ...a, ...next } : a));
  emit();
};

// AdapterWriteResult reports whether a toggle succeeded, with an inline reason
// on failure (surfaced beside the control, never a native popup).
export interface AdapterWriteResult {
  ok: boolean;
  reason?: string;
}

// setEnabled records whether an adapter is enabled. In mock mode it flips the
// in-memory catalog. In live mode it resolves the adapter's name from the
// loaded live catalog (the web addresses adapters by kind, but the RPC keys by
// name), calls SetAdapterEnabled with that name, and refetches so the list
// reflects the committed state. If the adapter for the kind is not loaded it
// returns an inline error rather than sending an empty name. The manager
// enforces the admin gate; a denied caller surfaces here as an inline error.
export const setEnabled = async (kind: AdapterKind, on: boolean): Promise<AdapterWriteResult> => {
  if (fleetMode() === "mock") {
    patch(kind, { enabled: on });
    const a = getAdapter(kind);
    recordAudit({
      kind: "protocol-toggled",
      summary: `${on ? "Enabled" : "Disabled"} ${a?.name ?? kind}`,
      targetKind: "protocol",
      targetPath: `/protocols/${kind}`,
    });
    return { ok: true };
  }

  // The kind -> name lookup needs the live catalog; load it if empty.
  if (liveAdapters.length === 0) await refreshLiveAdapters();
  const target = liveAdapters.find((a) => a.kind === kind);
  if (!target) {
    return { ok: false, reason: `Adapter "${kind}" is not loaded; cannot toggle.` };
  }

  try {
    await fleetClient().setAdapterEnabled({ enabled: on, name: target.name });
    await refreshLiveAdapters();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Toggle failed." };
  }
};

export const updateAdapter = (kind: AdapterKind, next: Partial<EnrollmentAdapter>): void =>
  patch(kind, next);

// Test-only.
export const __resetAdapters = (): void => {
  adapters = seed();
  emit();
};
