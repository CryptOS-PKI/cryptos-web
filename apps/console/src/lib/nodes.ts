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
import { validateNodeName } from "@/lib/fleet/node-name";
import {
  mockNodes,
  type IdentityState,
  type Node,
  type NodeProtocolStatus,
  type ProtocolKind,
} from "@/lib/mock";

import type { NodeSummary } from "@cryptos-pki/api-client/cryptos/fleet/v1/fleet_pb";
import {
  ServiceProtocol,
  type ProtocolStatus,
} from "@cryptos-pki/api-client/cryptos/node/v1/status_pb";

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

// ServiceProtocol -> the web's ProtocolKind. SCEP, TSA and Windows
// autoenrollment have no Pki block yet (cryptos#185, #108), so a node never
// reports them; an entry for one of those is dropped rather than widening the
// union.
const protocolKindByServiceProtocol: Partial<Record<ServiceProtocol, ProtocolKind>> = {
  [ServiceProtocol.ACME]: "acme",
  [ServiceProtocol.EST]: "est",
};

// fromProtocolStatus narrows one reported ProtocolStatus to the web shape, or
// undefined for a protocol the web doesn't recognize yet.
const fromProtocolStatus = (status: ProtocolStatus): NodeProtocolStatus | undefined => {
  const protocol = protocolKindByServiceProtocol[status.protocol];
  if (!protocol) return undefined;
  return {
    configured: status.configured,
    protocol,
    rebootPending: status.rebootPending,
    running: status.running,
  };
};

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
  id: summary.id,
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
  protocols: (summary.protocols ?? [])
    .map(fromProtocolStatus)
    .filter((p): p is NodeProtocolStatus => p !== undefined),
  rebootRequired: summary.rebootRequired,
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

// renameNode changes a node's display name (#87), which is an inventory-key
// edit, never a certificate edit: the signed subject CN is untouched, and
// there is no rename path for it anywhere in the console. It validates the
// way the manager's RenameNode does before any round trip, and no-ops when
// the name is unchanged (mirroring the manager, which records nothing for
// that case). Mock mode renames the fixture node in place so the fleet
// view, trust chain and topology selection all follow it; live mode routes
// through the manager and refetches, so every other view picks up the new
// name on its next render. The one view that does NOT follow on its own is
// the page the operator is looking at: its URL still names the node by its
// old name, so the caller must move it with the name this returns.
export const renameNode = async (node: Node, newName: string): Promise<string> => {
  const trimmed = newName.trim();
  const reason = validateNodeName(trimmed);
  if (reason) {
    throw new Error(reason);
  }
  if (trimmed === node.name) {
    return node.name;
  }

  if (fleetMode() === "mock") {
    if (nodes.some((n) => n.name === trimmed)) {
      throw new Error(`Another node already has the name "${trimmed}".`);
    }
    nodes = nodes.map((n) => (n.name === node.name ? { ...n, name: trimmed } : n));
    emit();
    return trimmed;
  }

  const response = await fleetClient().renameNode({ newName: trimmed, nodeId: node.id ?? "" });
  await refreshLiveNodes();
  return response.node?.name ?? trimmed;
};

// setMockNodeProtocol is the mock-mode write side of switchNodeProtocol
// (lib/protocols.ts): it updates the named node's reported protocol entry in
// place, mirroring the real node's behaviour that a switch changes `configured`
// immediately but `running` only after the next boot. `running` carries over
// from any existing entry (default false for a node that never reported one),
// so rebootPending is true exactly when the new configured state disagrees
// with it.
export const setMockNodeProtocol = (
  nodeName: string,
  protocol: ProtocolKind,
  enabled: boolean,
): void => {
  nodes = nodes.map((n) => {
    if (n.name !== nodeName) return n;
    const existing = n.protocols ?? [];
    const running = existing.find((p) => p.protocol === protocol)?.running ?? false;
    const next: NodeProtocolStatus = {
      configured: enabled,
      protocol,
      rebootPending: enabled !== running,
      running,
    };
    return { ...n, protocols: [...existing.filter((p) => p.protocol !== protocol), next] };
  });
  emit();
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
