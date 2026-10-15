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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listNodeTsaCertificates = vi.fn(() =>
  Promise.resolve({
    certificates: [
      {
        certPem: "-----BEGIN CERTIFICATE-----\nlive\n-----END CERTIFICATE-----",
        current: true,
        notAfter: "2027-01-01T00:00:00Z",
        notBefore: "2026-01-01T00:00:00Z",
        serialHex: "aabbcc",
        sha256Hex: "deadbeef",
      },
    ],
  }),
);
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({ listNodeTsaCertificates }),
}));

import { listNodeTsaCertificates as listNodeTsaCertificatesLib } from "@/lib/node-tsa";

describe("listNodeTsaCertificates live path", () => {
  beforeEach(() => {
    listNodeTsaCertificates.mockClear();
    vi.stubEnv("VITE_FLEET_MODE", "live");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("forwards the node name and flattens the manager's response", async () => {
    const certificates = await listNodeTsaCertificatesLib("acme-issuing-01");

    expect(listNodeTsaCertificates).toHaveBeenCalledWith(
      expect.objectContaining({ nodeName: "acme-issuing-01" }),
    );
    expect(certificates).toEqual([
      {
        certPem: "-----BEGIN CERTIFICATE-----\nlive\n-----END CERTIFICATE-----",
        current: true,
        notAfter: "2027-01-01T00:00:00Z",
        notBefore: "2026-01-01T00:00:00Z",
        serialHex: "aabbcc",
        sha256Hex: "deadbeef",
      },
    ]);
  });

  it("returns an empty list while the node's TSA is not running", async () => {
    listNodeTsaCertificates.mockResolvedValueOnce({ certificates: [] });
    const certificates = await listNodeTsaCertificatesLib("acme-issuing-01");
    expect(certificates).toEqual([]);
  });
});
