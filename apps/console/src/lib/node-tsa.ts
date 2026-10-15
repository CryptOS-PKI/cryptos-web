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

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// NodeTsaCertificate is one certificate a managed node's time-stamp authority
// has signed tokens with. No entry is current while the node's TSA is not
// running; the node still returns the others, kept for verifying old tokens.
export interface NodeTsaCertificate {
  certPem: string;
  current: boolean;
  notAfter: string;
  notBefore: string;
  serialHex: string;
  sha256Hex: string;
}

// A small, deterministic demo set: mock mode has no node to ask, so this
// stands in for ListNodeTsaCertificates the way mock-fixtures stand in for a
// live read elsewhere in the console.
const mockCertificates = (): NodeTsaCertificate[] => [
  {
    certPem: "-----BEGIN CERTIFICATE-----\nMIIB...mock-current...\n-----END CERTIFICATE-----",
    current: true,
    notAfter: "2027-07-01T00:00:00Z",
    notBefore: "2026-07-01T00:00:00Z",
    serialHex: "0a1b2c3d",
    sha256Hex: "7c3a9e2f1b6d48509d2b5c8e3f1a07241f4e8a7d2c9b0356deadbeef00112233",
  },
  {
    certPem: "-----BEGIN CERTIFICATE-----\nMIIB...mock-past...\n-----END CERTIFICATE-----",
    current: false,
    notAfter: "2026-07-01T00:00:00Z",
    notBefore: "2025-07-01T00:00:00Z",
    serialHex: "0f1e2d3c",
    sha256Hex: "1f4e8a7d2c9b03567c3a9e2f1b6d48509d2b5c8e3f1a0724deadbeef00445566",
  },
];

// listNodeTsaCertificates lists a managed node's time-stamp authority
// certificates, newest first, through the manager's ListNodeTsaCertificates.
// The node returns an empty list while its TSA is not running; in mock mode
// this returns a small canned set with one certificate marked current.
export const listNodeTsaCertificates = async (nodeName: string): Promise<NodeTsaCertificate[]> => {
  if (fleetMode() === "mock") {
    return mockCertificates();
  }

  const response = await fleetClient().listNodeTsaCertificates({ nodeName });
  return response.certificates.map((c) => ({
    certPem: c.certPem,
    current: c.current,
    notAfter: c.notAfter,
    notBefore: c.notBefore,
    serialHex: c.serialHex,
    sha256Hex: c.sha256Hex,
  }));
};
