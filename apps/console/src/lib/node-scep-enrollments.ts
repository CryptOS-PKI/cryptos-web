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

// NodeScepEnrollment is an initial SCEP enrolment on a managed node, held for
// an operator decision. The challenge that authorized it was consumed on
// arrival and is not carried.
export interface NodeScepEnrollment {
  challengeId: string;
  csrPem: string;
  dnsNames: string[];
  id: string;
  ipAddresses: string[];
  keyAlg: string;
  profile: string;
  receivedAt: string;
  subjectDn: string;
  transactionId: string;
}

const mockEnrollments = (): NodeScepEnrollment[] => [
  {
    challengeId: "ch-mock-1",
    csrPem: "-----BEGIN CERTIFICATE REQUEST-----\nmock\n-----END CERTIFICATE REQUEST-----",
    dnsNames: ["switch-1.example.org"],
    id: "enr-mock-1",
    ipAddresses: [],
    keyAlg: "RSA-2048",
    profile: "network-device",
    receivedAt: "2026-10-14T00:00:00Z",
    subjectDn: "CN=switch-1.example.org",
    transactionId: "txn-mock-1",
  },
];

// listNodeScepEnrollments lists a managed node's pending SCEP device
// enrolments, proxying the node's own queue. Operator level or above; mock
// mode returns a small canned set.
export const listNodeScepEnrollments = async (
  nodeName: string,
  profile = "",
): Promise<NodeScepEnrollment[]> => {
  if (fleetMode() === "mock") {
    return mockEnrollments().filter((e) => profile === "" || e.profile === profile);
  }

  const response = await fleetClient().listNodeScepEnrollments({ nodeName, profile });
  return response.enrollments.map((e) => ({
    challengeId: e.challengeId,
    csrPem: e.csrPem,
    dnsNames: e.dnsNames,
    id: e.id,
    ipAddresses: e.ipAddresses,
    keyAlg: e.keyAlg,
    profile: e.profile,
    receivedAt: e.receivedAt,
    subjectDn: e.subjectDn,
    transactionId: e.transactionId,
  }));
};

// approveNodeScepEnrollment approves a pending SCEP enrolment on a managed
// node, issuing the device a certificate, and returns the issued serial.
export const approveNodeScepEnrollment = async (nodeName: string, id: string): Promise<string> => {
  if (fleetMode() === "mock") {
    return "mock-serial-00112233";
  }

  const response = await fleetClient().approveNodeScepEnrollment({ id, nodeName });
  return response.serialHex;
};

// rejectNodeScepEnrollment rejects a pending SCEP enrolment on a managed node
// with a reason, recorded in the node's own audit log.
export const rejectNodeScepEnrollment = async (
  nodeName: string,
  id: string,
  reason: string,
): Promise<void> => {
  if (fleetMode() === "mock") {
    return;
  }

  await fleetClient().rejectNodeScepEnrollment({ id, nodeName, reason });
};
