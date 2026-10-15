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

const listNodeScepEnrollments = vi.fn(() =>
  Promise.resolve({
    enrollments: [
      {
        challengeId: "ch-live-1",
        csrPem: "-----BEGIN CERTIFICATE REQUEST-----\nlive\n-----END CERTIFICATE REQUEST-----",
        dnsNames: ["switch-1.example.org"],
        id: "enr-live-1",
        ipAddresses: [],
        keyAlg: "RSA-2048",
        profile: "network-device",
        receivedAt: "2026-01-01T00:00:00Z",
        subjectDn: "CN=switch-1.example.org",
        transactionId: "txn-live-1",
      },
    ],
  }),
);
const approveNodeScepEnrollment = vi.fn(() =>
  Promise.resolve({ enrollment: { id: "enr-live-1" }, serialHex: "live-serial" }),
);
const rejectNodeScepEnrollment = vi.fn(() => Promise.resolve({ enrollment: { id: "enr-live-1" } }));
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({
    approveNodeScepEnrollment,
    listNodeScepEnrollments,
    rejectNodeScepEnrollment,
  }),
}));

import {
  approveNodeScepEnrollment as approveNodeScepEnrollmentLib,
  listNodeScepEnrollments as listNodeScepEnrollmentsLib,
  rejectNodeScepEnrollment as rejectNodeScepEnrollmentLib,
} from "@/lib/node-scep-enrollments";

describe("node-scep-enrollments live path", () => {
  beforeEach(() => {
    listNodeScepEnrollments.mockClear();
    approveNodeScepEnrollment.mockClear();
    rejectNodeScepEnrollment.mockClear();
    vi.stubEnv("VITE_FLEET_MODE", "live");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("listNodeScepEnrollments forwards the node name and profile, flattening the response", async () => {
    const enrollments = await listNodeScepEnrollmentsLib("acme-issuing-01", "network-device");
    expect(listNodeScepEnrollments).toHaveBeenCalledWith({
      nodeName: "acme-issuing-01",
      profile: "network-device",
    });
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0]?.subjectDn).toBe("CN=switch-1.example.org");
  });

  it("approveNodeScepEnrollment forwards the id and returns the serial", async () => {
    const serial = await approveNodeScepEnrollmentLib("acme-issuing-01", "enr-live-1");
    expect(approveNodeScepEnrollment).toHaveBeenCalledWith({
      id: "enr-live-1",
      nodeName: "acme-issuing-01",
    });
    expect(serial).toBe("live-serial");
  });

  it("rejectNodeScepEnrollment forwards the id and reason", async () => {
    await rejectNodeScepEnrollmentLib("acme-issuing-01", "enr-live-1", "unexpected device");
    expect(rejectNodeScepEnrollment).toHaveBeenCalledWith({
      id: "enr-live-1",
      nodeName: "acme-issuing-01",
      reason: "unexpected device",
    });
  });
});
