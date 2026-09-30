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

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";
import { mockNodes, type IdentityState, type Node } from "@/lib/mock";

import type { NodeSummary } from "@/gen/fleet/cryptos/fleet/v1/fleet_pb";

// The mock fleet. Seeded from the mock fixture; mutated by enrollment approval
// (addNode). useSyncExternalStore lets the topology, nodes table, and root list
// re-render when the fleet changes. This path is unchanged by the live seam
// below -- `mock` mode never touches the live store.
let nodes: Node[] = [...mockNodes];
const listeners = new Set<() => void>();
const emit = (): void => {
  for (const l of listeners) l();
};
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const nodesList = (): Node[] => nodes;
export const getNode = (name: string): Node | undefined =>
  (fleetMode() === "mock" ? nodes : liveNodes).find((n) => n.name === name);
export const getNodeByCn = (cn: string): Node | undefined => nodes.find((n) => n.cn === cn);

export const addNode = (node: Node): void => {
  nodes = [...nodes, node];
  emit();
};

// The live fleet, populated by ListNodes over Connect. A separate store from
// the mock fleet above: `live`/`live-auth` read this array and never touch the
// mock one, so flipping VITE_FLEET_MODE never mixes the two.
let liveNodes: Node[] = [];
const liveListeners = new Set<() => void>();
const emitLive = (): void => {
  for (const l of liveListeners) l();
};
const subscribeLive = (l: () => void): (() => void) => {
  liveListeners.add(l);
  return () => liveListeners.delete(l);
};

const knownIdentityStates = new Set<IdentityState>(["ESTABLISHED", "AWAITING_CERT", "REVOKED"]);

// NodeSummary -> the web Node shape. The manager's read-through view only
// carries what a node reports over its status/identity RPCs, so every field
// the summary lacks (issued/revoked counts, tpm, crl/ocsp, parentCn, ...) gets
// a display-safe default rather than being left undefined -- the existing
// pages (nodes table, fleet topology, node detail panel) render the same
// fixed shape whether the data came from the mock store or the manager.
export const fromSummary = (summary: NodeSummary): Node => ({
  address: summary.address,
  bootCount: 0,
  cn: summary.cn,
  fleetManager: { linked: summary.health === 1 },
  identityState: knownIdentityStates.has(summary.identityState as IdentityState)
    ? (summary.identityState as IdentityState)
    : "AWAITING_CERT",
  issued: 0,
  issuer: summary.issuer,
  name: summary.name,
  // A subordinate's issuer names its parent CA's subject CN, which is how the
  // topology links it under the root; a self-signed root (issuer === cn) has no
  // parent.
  parentCn: summary.issuer && summary.issuer !== summary.cn ? summary.issuer : undefined,
  revoked: 0,
  role: (summary.role || "issuing") as Node["role"],
  tpm: summary.healthDetail || "UNKNOWN",
  uptime: "",
});

const NODE_POLL_INTERVAL_MS = 10_000;

// Fetches ListNodes once and (for `live`/`live-auth`) keeps polling on an
// interval so a node's health/identity flips are picked up without a reload.
// Errors are swallowed to a console warning: a manager outage should degrade
// the fleet view to whatever it last had, not throw the page into an error
// boundary.
export const refreshLiveNodes = async (): Promise<void> => {
  try {
    const response = await fleetClient().listNodes({});
    liveNodes = response.nodes.map(fromSummary);
    emitLive();
  } catch (error) {
    // eslint-disable-next-line no-console -- surfaced for local live debugging
    console.warn("fleet: ListNodes failed", error);
  }
};

export const useNodes = (): Node[] => {
  const mode = fleetMode();

  useEffect(() => {
    if (mode === "mock") return;
    void refreshLiveNodes();
    const interval = setInterval(() => void refreshLiveNodes(), NODE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode]);

  return useSyncExternalStore(
    mode === "mock" ? subscribe : subscribeLive,
    () => (mode === "mock" ? nodes : liveNodes),
    () => (mode === "mock" ? nodes : liveNodes),
  );
};

// useNode is the reactive single-node lookup for per-node pages. It subscribes
// via useNodes so the live fleet is fetched and the page re-renders when it
// arrives — a bare getNode() reads the module store synchronously and, on a
// direct load or refresh in live mode, finds an empty store and never recovers.
export const useNode = (name: string | undefined): Node | undefined => {
  const all = useNodes();
  return name ? all.find((n) => n.name === name) : undefined;
};

// The trust chain from the root down to this node, following parentCn. Guards a
// missing parent link and a cycle so a broken fixture can't loop forever.
export const chainToRoot = (node: Node): Node[] => {
  const chain: Node[] = [node];
  const seen = new Set<string>([node.name]);
  let current = node;
  while (current.parentCn) {
    const parent = getNodeByCn(current.parentCn);
    if (!parent || seen.has(parent.name)) break;
    chain.unshift(parent);
    seen.add(parent.name);
    current = parent;
  }
  return chain;
};

// Test-only: restore the seeded fixture between tests.
export const __resetNodes = (): void => {
  nodes = [...mockNodes];
  emit();
};
