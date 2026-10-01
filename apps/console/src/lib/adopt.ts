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

import { create } from "@bufbuild/protobuf";

import type { MachineConfig } from "@cryptos-pki/api-client/cryptos/node/v1/config_pb";
import {
  type InstallDisk,
  InstallDiskSchema,
} from "@cryptos-pki/api-client/cryptos/node/v1/node_pb";
import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// Adopt-a-new-node (S10). The web drives three manager RPCs: PreviewAdoption
// (unary, trust-on-first-use fingerprint), AdoptNode (server-streaming, live
// phase progress) and ConfirmAdoptionFingerprint (unary, confirms the
// installed node's certificate while the stream waits). The web never contacts
// the maintenance node directly and never sends any secret to an unpinned
// endpoint -- the manager holds the pin and orchestrates the whole apply ->
// install -> reboot -> confirm -> ceremony flow.

// AdoptionPreview is the maintenance node's presented identity the operator
// confirms before adoption proceeds.
export interface AdoptionPreview {
  certSha256: string;
  subject: string;
}

// AdoptPhase is one streamed step of the orchestration. `done` marks the final
// message; the phase string is one of the manager's documented phases
// (applying-config, installing, awaiting-reboot,
// awaiting-fingerprint-confirmation, ceremony, established,
// awaiting-certificate) or an error phase when a step fails. adoptionId names
// the run; presentedCertSha256 is set only while the manager waits for the
// installed node's fingerprint to be confirmed.
export interface AdoptPhase {
  adoptionId: string;
  detail: string;
  done: boolean;
  phase: string;
  presentedCertSha256: string;
}

export const AWAITING_FINGERPRINT = "awaiting-fingerprint-confirmation";

const normalizeFingerprint = (fp: string): string => fp.replaceAll(/[\s:]/g, "").toLowerCase();

// fingerprintsMatch compares two SHA-256 fingerprints the way the manager
// does: case, colons and whitespace are ignored.
export const fingerprintsMatch = (a: string, b: string): boolean => {
  const na = normalizeFingerprint(a);
  return na !== "" && na === normalizeFingerprint(b);
};

// formatFingerprint renders a fingerprint as colon-separated uppercase pairs,
// easier to read against the node console than one long hex run.
export const formatFingerprint = (fp: string): string =>
  (normalizeFingerprint(fp).match(/.{1,2}/g) ?? []).join(":").toUpperCase();

// The mock adoption's installed-node fingerprint, and the confirmations it is
// waiting for, keyed by adoption ID.
const MOCK_INSTALLED_SHA256 = "5f".repeat(32);
const mockWaiting = new Map<string, { reject: (e: Error) => void; resolve: () => void }>();
let mockAdoptions = 0;

// confirmAdoptionFingerprint tells the manager the operator checked the
// installed node's fingerprint against its console, so the paused adoption
// continues on the AdoptNode stream. A mismatch is refused by the manager and
// the adoption fails; the error propagates to the caller.
export const confirmAdoptionFingerprint = async (
  adoptionId: string,
  certSha256: string,
): Promise<void> => {
  if (!adoptionId || !certSha256) {
    throw new Error("An adoption and a fingerprint are required.");
  }
  if (fleetMode() === "mock") {
    const waiting = mockWaiting.get(adoptionId);
    if (!waiting) {
      throw new Error(`No adoption ${adoptionId} is waiting for a fingerprint.`);
    }
    mockWaiting.delete(adoptionId);
    if (!fingerprintsMatch(certSha256, MOCK_INSTALLED_SHA256)) {
      const mismatch = new Error(
        "The confirmed fingerprint does not match the node's certificate.",
      );
      waiting.reject(mismatch);
      throw mismatch;
    }
    waiting.resolve();
    return;
  }
  await fleetClient().confirmAdoptionFingerprint({ adoptionId, certSha256 });
};

// previewAdoption fetches the maintenance node's certificate fingerprint and
// subject so the operator can confirm it (TOFU). `mock` returns a stable
// canned preview so the wizard is exercisable offline; live surfaces a
// manager/dial error to the caller with no silent fallback.
export const previewAdoption = async (endpoint: string): Promise<AdoptionPreview> => {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    throw new Error("A maintenance endpoint is required.");
  }

  if (fleetMode() === "mock") {
    return {
      certSha256: "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01",
      subject: `CN=maintenance,O=CryptOS (${trimmed})`,
    };
  }

  const response = await fleetClient().previewAdoption({ endpoint: trimmed });
  return { certSha256: response.certSha256, subject: response.subject };
};

// firstPemBlock returns the first PEM CERTIFICATE block of a chain (leaf-first),
// or "" when none is present. A subordinate's parent anchor must be exactly one
// certificate -- the parent's own CA cert -- so from a parent's identity chain
// (which for an intermediate is [self, ..root]) we take the first block.
const firstPemBlock = (chainPem: string): string => {
  const match = chainPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  return match ? `${match[0]}\n` : "";
};

// fetchParentAnchor loads the chosen parent node's own CA certificate (PEM) to
// embed as pki.parent.ca_cert_pem when adopting a subordinate: the child pins
// this anchor and later verifies the parent-signed chain against it. `mock`
// returns a canned block so the wizard is exercisable offline.
export const fetchParentAnchor = async (nodeName: string): Promise<string> => {
  if (fleetMode() === "mock") {
    return `-----BEGIN CERTIFICATE-----\nMOCK-PARENT-ANCHOR (${nodeName})\n-----END CERTIFICATE-----\n`;
  }
  const response = await fleetClient().getNode({ name: nodeName });
  const anchor = firstPemBlock(response.node?.identity?.chainPem ?? "");
  if (!anchor) {
    throw new Error(`Parent ${nodeName} has no certificate to anchor to yet.`);
  }
  return anchor;
};

// listInstallDisks returns the candidate install disks a maintenance node
// reports, so the adopt wizard can offer real devices instead of asking the
// operator to guess a device path. `mock` returns a canned list for offline UI
// work. Pinned to the fingerprint the operator confirmed via previewAdoption.
export const listInstallDisks = async (
  endpoint: string,
  pinnedCertSha256: string,
): Promise<InstallDisk[]> => {
  if (fleetMode() === "mock") {
    return [
      create(InstallDiskSchema, {
        path: "/dev/nvme0n1",
        sizeBytes: 512n * 1024n * 1024n * 1024n,
        model: "Mock NVMe SSD",
        rotational: false,
      }),
      create(InstallDiskSchema, {
        path: "/dev/sda",
        sizeBytes: 1024n * 1024n * 1024n * 1024n,
        model: "Mock SATA disk",
        rotational: true,
      }),
    ];
  }
  const response = await fleetClient().listInstallDisks({
    endpoint: endpoint.trim(),
    pinnedCertSha256,
  });
  return response.disks;
};

// formatDiskSize renders a disk's byte size as a human GiB/TiB label for the
// adopt dropdown.
export const formatDiskSize = (bytes: bigint): string => {
  const gib = Number(bytes) / (1024 * 1024 * 1024);
  if (gib >= 1024) return `${(gib / 1024).toFixed(1)} TiB`;
  return `${gib.toFixed(0)} GiB`;
};

// adoptNode drives the orchestrated adoption and yields each streamed phase.
// It is an async generator so the wizard can render progress as it arrives.
// In `mock` mode it walks a scripted sequence of phases (no live stream) so the
// progress UI is demonstrable offline; live relays the manager's stream, and a
// manager/node error propagates out of the iteration for the wizard to show
// inline rather than being swallowed. No secret is sent to an unpinned
// endpoint: the operator-confirmed fingerprint is passed as the pin.
export async function* adoptNode(
  endpoint: string,
  pinnedCertSha256: string,
  config: MachineConfig,
  signal?: AbortSignal,
): AsyncGenerator<AdoptPhase> {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    throw new Error("A maintenance endpoint is required.");
  }
  if (!pinnedCertSha256) {
    throw new Error("Confirm the certificate fingerprint before adopting.");
  }

  if (fleetMode() === "mock") {
    // A subordinate skips the ceremony and ends awaiting a parent-signed cert;
    // a root self-signs via the ceremony and reaches established. Keep the mock
    // script coherent with the role so the offline demo matches the live flow.
    const kind = config.role?.kind ?? "";
    const subordinate = kind !== "" && kind !== "root";
    mockAdoptions += 1;
    const adoptionId = `mock-adoption-${mockAdoptions}`;
    const step = (phase: string, detail: string, done = false): AdoptPhase => ({
      adoptionId,
      detail,
      done,
      phase,
      presentedCertSha256: phase === AWAITING_FINGERPRINT ? MOCK_INSTALLED_SHA256 : "",
    });
    const common: AdoptPhase[] = [
      step("applying-config", "Applying the initial machine config."),
      step("installing", "Installing the CryptOS runtime."),
      step("awaiting-reboot", "Waiting for the node to reboot."),
      step(AWAITING_FINGERPRINT, "Confirm the node's Mgmt SHA-256 from its console."),
    ];
    const scripted: AdoptPhase[] = subordinate
      ? [
          ...common,
          step(
            "awaiting-certificate",
            "Subordinate provisioned; awaiting a parent-signed certificate.",
            true,
          ),
        ]
      : [
          ...common,
          step("ceremony", "Running the enrollment ceremony."),
          step("established", "Node established and linked to the fleet.", true),
        ];
    for (const s of scripted) {
      // A short delay makes the mock progress visibly step through phases.
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (s.phase === AWAITING_FINGERPRINT) {
        const confirmed = new Promise<void>((resolve, reject) => {
          mockWaiting.set(adoptionId, { reject, resolve });
        });
        // Keep a mismatch that nobody is awaiting yet from surfacing as an
        // unhandled rejection; it still rejects the await below.
        confirmed.catch(() => undefined);
        yield s;
        await confirmed;
        continue;
      }
      yield s;
    }
    return;
  }

  const request = { config, endpoint: trimmed, pinnedCertSha256 };
  const stream = signal
    ? fleetClient().adoptNode(request, { signal })
    : fleetClient().adoptNode(request);
  for await (const message of stream) {
    yield {
      adoptionId: message.adoptionId,
      detail: message.detail,
      done: message.done,
      phase: message.phase,
      presentedCertSha256: message.presentedCertSha256,
    };
  }
}
