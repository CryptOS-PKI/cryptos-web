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

import type { FleetMode } from "@/lib/fleet/mode";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// currentMode drives the mocked fleetMode(); each describe sets it in a
// beforeEach so the mock and live paths do not leak into one another.
let currentMode: FleetMode = "mock";
const listProfiles = vi.fn();
const createProfileRpc = vi.fn();
const updateProfileRpc = vi.fn();
const deleteProfileRpc = vi.fn();

vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => currentMode }));
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({
    createProfile: createProfileRpc,
    deleteProfile: deleteProfileRpc,
    listProfiles,
    updateProfile: updateProfileRpc,
  }),
}));

import {
  __resetProfiles,
  type CertProfile,
  createProfile,
  deleteProfile,
  emptySans,
  emptySubject,
  getProfile,
  profilesList,
  updateProfile,
} from "@/lib/profiles";

const sample = (name: string, over: Partial<CertProfile> = {}): CertProfile => ({
  extKeyUsage: ["client_auth"],
  extraExtensions: [],
  isCA: false,
  keyAlg: "ECDSA-P384",
  keyUsage: ["digital_signature"],
  name,
  sans: emptySans(),
  subject: emptySubject(),
  validityDays: 365,
  ...over,
});

describe("profiles store (mock)", () => {
  beforeEach(() => {
    currentMode = "mock";
    __resetProfiles();
  });

  it("seeds AD-relevant templates including a Domain Controller profile", () => {
    expect(profilesList().length).toBeGreaterThanOrEqual(5);
    expect(getProfile("Domain Controller")?.extKeyUsage).toContain("server_auth");
  });

  it("createProfile adds a profile and rejects a duplicate name", async () => {
    const before = profilesList().length;
    const ok = await createProfile(sample("VPN Client"));
    expect(ok.ok).toBe(true);
    expect(profilesList().length).toBe(before + 1);

    const dup = await createProfile(sample("VPN Client"));
    expect(dup.ok).toBe(false);
  });

  it("createProfile round-trips subject, typed SANs, and an extra extension", async () => {
    await createProfile(
      sample("Full", {
        extraExtensions: [{ critical: true, oid: "1.2.3.4", value: "AQID" }],
        sans: { dns: ["a.example"], email: ["ops@example"], ip: ["10.0.0.1"], uri: [] },
        subject: { commonName: "svc", country: "US", organization: "ACME" },
      }),
    );
    const got = getProfile("Full");
    expect(got?.subject.commonName).toBe("svc");
    expect(got?.sans.dns).toEqual(["a.example"]);
    expect(got?.extraExtensions[0]?.oid).toBe("1.2.3.4");
  });

  it("updateProfile replaces by name", async () => {
    await updateProfile("Code Signing", sample("Code Signing", { validityDays: 730 }));
    expect(getProfile("Code Signing")?.validityDays).toBe(730);
  });

  it("deleteProfile removes by name", async () => {
    const before = profilesList().length;
    await deleteProfile("Code Signing");
    expect(getProfile("Code Signing")).toBeUndefined();
    expect(profilesList().length).toBe(before - 1);
  });
});

// The live path branches on fleetMode() and drives the FleetService RPCs; the
// client and mode are stubbed above so no real network is needed.
describe("profiles store (live)", () => {
  beforeEach(() => {
    currentMode = "live";
    listProfiles.mockReset().mockResolvedValue({ items: [] });
    createProfileRpc.mockReset().mockResolvedValue({});
    updateProfileRpc.mockReset().mockResolvedValue({});
    deleteProfileRpc.mockReset().mockResolvedValue({});
  });
  afterEach(() => vi.clearAllMocks());

  it("createProfile calls the RPC with a full CertificateProfile and refetches", async () => {
    const res = await createProfile(
      sample("Live", {
        extraExtensions: [{ critical: false, oid: "1.3.6", value: "AAE=" }],
        sans: { dns: ["x.example"], email: [], ip: ["10.1.2.3"], uri: ["spiffe://x"] },
        subject: { commonName: "cn", country: "US", organization: "Org" },
      }),
    );
    expect(res.ok).toBe(true);

    expect(createProfileRpc).toHaveBeenCalledTimes(1);
    const arg = createProfileRpc.mock.calls[0][0].profile;
    expect(arg.name).toBe("Live");
    expect(arg.subject.commonName).toBe("cn");
    expect(arg.sans.dns).toEqual(["x.example"]);
    expect(arg.sans.ip).toEqual(["10.1.2.3"]);
    expect(arg.extraExtensions).toHaveLength(1);
    expect(arg.extraExtensions[0].oid).toBe("1.3.6");
    expect(arg.extraExtensions[0].value).toBeInstanceOf(Uint8Array);

    // Refetch after the write.
    expect(listProfiles).toHaveBeenCalledTimes(1);
  });

  it("updateProfile and deleteProfile call their RPCs and refetch", async () => {
    await updateProfile("Live", sample("Live", { validityDays: 90 }));
    expect(updateProfileRpc).toHaveBeenCalledTimes(1);
    expect(listProfiles).toHaveBeenCalledTimes(1);

    await deleteProfile("Live");
    expect(deleteProfileRpc).toHaveBeenCalledWith({ name: "Live" });
    expect(listProfiles).toHaveBeenCalledTimes(2);
  });

  it("surfaces an RPC error inline rather than throwing", async () => {
    createProfileRpc.mockRejectedValueOnce(new Error("already exists"));
    const res = await createProfile(sample("Dup"));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("already exists");
  });
});
