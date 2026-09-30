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

import { create } from "@bufbuild/protobuf";
import { useEffect, useSyncExternalStore } from "react";

import { recordAudit } from "@/lib/audit";
import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

import {
  type CertificateProfile as ProtoCertProfile,
  CertificateProfileSchema,
} from "@/gen/fleet/cryptos/v1/config_pb";

// ProfileSubject is the certificate subject fields the catalog edits.
export interface ProfileSubject {
  commonName: string;
  country: string;
  organization: string;
}

// ProfileSans mirrors cryptos.v1.SubjectAltNames: typed SAN lists by category.
export interface ProfileSans {
  dns: string[];
  email: string[];
  ip: string[];
  uri: string[];
}

// ProfileExtension mirrors cryptos.v1.X509Extension: a raw-OID escape hatch.
// `value` is a base64 string in the UI; it maps to the proto's `bytes value`.
export interface ProfileExtension {
  critical: boolean;
  oid: string;
  value: string;
}

// CertProfile mirrors cryptos.v1.CertificateProfile (config.proto): the reusable
// issuance template a node stores in pki.profiles[] and the manager's catalog
// holds verbatim. The web edits the whole shape so a catalog profile applies to
// a node without loss.
export interface CertProfile {
  extKeyUsage: string[];
  extraExtensions: ProfileExtension[];
  isCA: boolean;
  keyAlg: string;
  keyUsage: string[];
  name: string;
  pathLen?: number;
  sans: ProfileSans;
  subject: ProfileSubject;
  validityDays: number;
}

export const KEY_ALG_OPTIONS = ["ECDSA-P256", "ECDSA-P384", "RSA-3072", "RSA-4096"];
export const KEY_USAGE_OPTIONS = ["digital_signature", "key_encipherment", "cert_sign", "crl_sign"];
export const EXT_KEY_USAGE_OPTIONS = ["server_auth", "client_auth", "code_signing"];

export const emptySans = (): ProfileSans => ({ dns: [], email: [], ip: [], uri: [] });
export const emptySubject = (): ProfileSubject => ({
  commonName: "",
  country: "",
  organization: "",
});

const seed = (): CertProfile[] => [
  {
    extKeyUsage: ["server_auth"],
    extraExtensions: [],
    isCA: false,
    keyAlg: "ECDSA-P384",
    keyUsage: ["digital_signature", "key_encipherment"],
    name: "TLS Server (LDAPS)",
    sans: emptySans(),
    subject: emptySubject(),
    validityDays: 365,
  },
  {
    extKeyUsage: ["client_auth"],
    extraExtensions: [],
    isCA: false,
    keyAlg: "ECDSA-P384",
    keyUsage: ["digital_signature"],
    name: "TLS Client",
    sans: emptySans(),
    subject: emptySubject(),
    validityDays: 365,
  },
  {
    extKeyUsage: ["server_auth", "client_auth"],
    extraExtensions: [],
    isCA: false,
    keyAlg: "ECDSA-P384",
    keyUsage: ["digital_signature", "key_encipherment"],
    name: "Domain Controller",
    sans: emptySans(),
    subject: emptySubject(),
    validityDays: 365,
  },
  {
    extKeyUsage: ["code_signing"],
    extraExtensions: [],
    isCA: false,
    keyAlg: "RSA-3072",
    keyUsage: ["digital_signature"],
    name: "Code Signing",
    sans: emptySans(),
    subject: emptySubject(),
    validityDays: 1095,
  },
  {
    extKeyUsage: [],
    extraExtensions: [],
    isCA: true,
    keyAlg: "ECDSA-P384",
    keyUsage: ["cert_sign", "crl_sign"],
    name: "Subordinate CA",
    pathLen: 0,
    sans: emptySans(),
    subject: emptySubject(),
    validityDays: 1825,
  },
];

let profiles: CertProfile[] = seed();
const listeners = new Set<() => void>();
const emit = (): void => {
  for (const l of listeners) l();
};
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const profilesList = (): CertProfile[] => profiles;
export const getProfile = (name: string): CertProfile | undefined =>
  profiles.find((p) => p.name === name);

// The live profile catalog, populated by ListProfiles over Connect. A
// separate store from the mock catalog above: `live`/`live-auth` read this
// array and never touch the mock one, so flipping VITE_FLEET_MODE never
// mixes the two. Mirrors the live-store pattern in lib/nodes.ts.
let liveProfiles: CertProfile[] = [];
const liveListeners = new Set<() => void>();
const emitLive = (): void => {
  for (const l of liveListeners) l();
};
const subscribeLive = (l: () => void): (() => void) => {
  liveListeners.add(l);
  return () => liveListeners.delete(l);
};

// bytesToBase64 / base64ToBytes bridge the UI's base64 extension value and the
// proto's bytes value.
const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};
const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
};

// fromProtoProfile maps a cryptos.v1.CertificateProfile onto the web shape.
// is_ca and path_len live under basic_constraints; a zero path_len on a
// non-CA profile is treated as "not set". Absent nested messages become empty
// containers so the form always has a defined shape to edit.
export const fromProtoProfile = (profile: ProtoCertProfile): CertProfile => {
  const isCA = profile.basicConstraints?.isCa ?? false;
  const rawPathLen = profile.basicConstraints?.pathLen;
  return {
    extKeyUsage: profile.extKeyUsage,
    extraExtensions: profile.extraExtensions.map((e) => ({
      critical: e.critical,
      oid: e.oid,
      value: bytesToBase64(e.value),
    })),
    isCA,
    keyAlg: profile.keyAlg,
    keyUsage: profile.keyUsage,
    name: profile.name,
    pathLen: isCA && rawPathLen !== undefined ? rawPathLen : undefined,
    sans: {
      dns: profile.sans?.dns ?? [],
      email: profile.sans?.email ?? [],
      ip: profile.sans?.ip ?? [],
      uri: profile.sans?.uri ?? [],
    },
    subject: {
      commonName: profile.subject?.commonName ?? "",
      country: profile.subject?.country ?? "",
      organization: profile.subject?.organization ?? "",
    },
    validityDays: profile.validityDays,
  };
};

// toProtoProfile builds a cryptos.v1.CertificateProfile from the web shape for
// the live create/update RPCs. The node accepts it verbatim.
export const toProtoProfile = (p: CertProfile): ProtoCertProfile =>
  create(CertificateProfileSchema, {
    basicConstraints: {
      isCa: p.isCA,
      pathLen: p.isCA ? (p.pathLen ?? 0) : undefined,
    },
    extKeyUsage: p.extKeyUsage,
    extraExtensions: p.extraExtensions.map((e) => ({
      critical: e.critical,
      oid: e.oid,
      value: base64ToBytes(e.value),
    })),
    keyAlg: p.keyAlg,
    keyUsage: p.keyUsage,
    name: p.name,
    sans: { dns: p.sans.dns, email: p.sans.email, ip: p.sans.ip, uri: p.sans.uri },
    subject: {
      commonName: p.subject.commonName,
      country: p.subject.country,
      organization: p.subject.organization,
    },
    validityDays: p.validityDays,
  });

const PROFILES_POLL_INTERVAL_MS = 10_000;

// Fetches ListProfiles once and (for `live`/`live-auth`) keeps polling on an
// interval so a newly created/updated profile is picked up without a reload.
// Errors are swallowed to a console warning: a manager outage should degrade
// the profiles view to whatever it last had, not throw the page into an
// error boundary.
const refreshLiveProfiles = async (): Promise<void> => {
  try {
    const response = await fleetClient().listProfiles({});
    liveProfiles = response.items.map(fromProtoProfile);
    emitLive();
  } catch (error) {
    // eslint-disable-next-line no-console -- surfaced for local live debugging
    console.warn("fleet: ListProfiles failed", error);
  }
};

export const useProfiles = (): CertProfile[] => {
  const mode = fleetMode();

  useEffect(() => {
    if (mode === "mock") return;
    void refreshLiveProfiles();
    const interval = setInterval(() => void refreshLiveProfiles(), PROFILES_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode]);

  return useSyncExternalStore(
    mode === "mock" ? subscribe : subscribeLive,
    () => (mode === "mock" ? profiles : liveProfiles),
    () => (mode === "mock" ? profiles : liveProfiles),
  );
};

// WriteResult reports whether a catalog write succeeded, with an inline reason
// on failure (surfaced in the form, never a native popup).
export interface WriteResult {
  ok: boolean;
  reason?: string;
}

// createProfile adds a profile. In mock mode it mutates the in-memory catalog;
// in live mode it calls the manager's CreateProfile RPC with the full
// CertificateProfile, then refetches so the list reflects the committed state.
export const createProfile = async (p: CertProfile): Promise<WriteResult> => {
  if (!p.name.trim()) return { ok: false, reason: "Name is required." };

  if (fleetMode() === "mock") {
    if (getProfile(p.name))
      return { ok: false, reason: `A profile named "${p.name}" already exists.` };
    profiles = [...profiles, p];
    emit();
    recordAudit({
      kind: "profile-created",
      summary: `Created profile ${p.name}`,
      targetKind: "profile",
      targetPath: `/profiles/${p.name}`,
    });
    return { ok: true };
  }

  try {
    await fleetClient().createProfile({ profile: toProtoProfile(p) });
    await refreshLiveProfiles();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Create failed." };
  }
};

// updateProfile replaces a profile by name. Mock mode patches the in-memory
// catalog; live mode calls UpdateProfile then refetches.
export const updateProfile = async (name: string, next: CertProfile): Promise<WriteResult> => {
  if (fleetMode() === "mock") {
    const exists = profiles.some((p) => p.name === name);
    profiles = profiles.map((p) => (p.name === name ? { ...next, name } : p));
    emit();
    if (exists) {
      recordAudit({
        kind: "profile-updated",
        summary: `Updated profile ${name}`,
        targetKind: "profile",
        targetPath: `/profiles/${name}`,
      });
    }
    return { ok: true };
  }

  try {
    await fleetClient().updateProfile({ profile: toProtoProfile({ ...next, name }) });
    await refreshLiveProfiles();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Update failed." };
  }
};

// deleteProfile removes a profile by name. Mock mode drops it from the
// in-memory catalog; live mode calls DeleteProfile then refetches.
export const deleteProfile = async (name: string): Promise<WriteResult> => {
  if (fleetMode() === "mock") {
    profiles = profiles.filter((p) => p.name !== name);
    emit();
    recordAudit({
      kind: "profile-deleted",
      summary: `Deleted profile ${name}`,
      targetKind: "profile",
      targetPath: `/profiles/${name}`,
    });
    return { ok: true };
  }

  try {
    await fleetClient().deleteProfile({ name });
    await refreshLiveProfiles();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Delete failed." };
  }
};

// ApplyToNodeResult reports the node's config generation after an apply and
// whether the change takes effect only on reboot.
export interface ApplyToNodeResult {
  generation: number;
  requiresReboot: boolean;
}

// applyProfileToNode pushes a catalog profile onto a managed node via the
// manager's ApplyProfileToNode RPC. It is a live-only write: mock mode has no
// node config to reconcile against, so it is a clear error rather than a silent
// no-op.
export const applyProfileToNode = async (
  nodeName: string,
  profileName: string,
): Promise<ApplyToNodeResult> => {
  if (fleetMode() === "mock") {
    throw new Error("applyProfileToNode: reconcile requires live mode");
  }
  const response = await fleetClient().applyProfileToNode({ nodeName, profileName });
  return {
    generation: Number(response.generation),
    requiresReboot: response.requiresReboot,
  };
};

// Test-only.
export const __resetProfiles = (): void => {
  profiles = seed();
  emit();
};
