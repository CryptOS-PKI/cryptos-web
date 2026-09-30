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

import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetCerts } from "@/lib/certs";
import {
  __resetEnrollments,
  approveEnrollment,
  canApprove,
  createEnrollment,
  enrollmentsList,
  fromProtoRequest,
  getEnrollment,
  rejectEnrollment,
  requestEnrollment,
} from "@/lib/enrollment";
import { __resetNodes, getNode } from "@/lib/nodes";

import type { EnrollmentRequest as ProtoEnrollmentRequest } from "@/gen/fleet/cryptos/fleet/v1/fleet_pb";

const listEnrollments = vi.fn();
const createEnrollmentRpc = vi.fn();
const approveEnrollmentRpc = vi.fn();
const rejectEnrollmentRpc = vi.fn();
let mode: "live" | "mock" = "mock";

vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({
    approveEnrollment: approveEnrollmentRpc,
    createEnrollment: createEnrollmentRpc,
    listEnrollments,
    rejectEnrollment: rejectEnrollmentRpc,
  }),
}));
vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => mode }));

describe("enrollment store (mock)", () => {
  beforeEach(() => {
    mode = "mock";
    __resetNodes();
    __resetCerts();
    __resetEnrollments();
  });

  it("seeds pending requests", () => {
    expect(enrollmentsList().some((r) => r.status === "PENDING")).toBe(true);
  });

  it("seeds SUBORDINATE kind for back-compat mock data", () => {
    expect(enrollmentsList().every((r) => r.kind === "SUBORDINATE")).toBe(true);
  });

  it("approve under a capable parent admits an ESTABLISHED node", async () => {
    const req = requestEnrollment({
      address: "10.20.1.90:8443",
      attestation: { nodeId: "nid-new", tpm: "TPM · sealed" },
      csr: { keyType: "ECDSA P-384", subjectCn: "ACME Issuing CA NEW" },
      parentCn: "ACME Intermediate CA G1", // ESTABLISHED intermediate -> can issue
      proposedName: "acme-issuing-new",
      role: "issuing",
    });
    await approveEnrollment(req.id);
    expect(getEnrollment(req.id)?.status).toBe("APPROVED");
    const admitted = getNode("acme-issuing-new");
    expect(admitted?.identityState).toBe("ESTABLISHED");
    expect(getEnrollment(req.id)?.admittedNodeName).toBe("acme-issuing-new");
  });

  it("canApprove is false when the parent cannot issue (revoked parent)", () => {
    const req = requestEnrollment({
      address: "10.20.2.90:8443",
      attestation: { nodeId: "nid-bad", tpm: "UNAVAILABLE · nodeID" },
      csr: { keyType: "ECDSA P-384", subjectCn: "ACME Issuing CA BAD" },
      parentCn: "ACME Intermediate CA G2", // REVOKED -> cannot issue
      proposedName: "acme-issuing-bad",
      role: "issuing",
    });
    expect(canApprove(req).ok).toBe(false);
  });

  it("reject records the reason and admits no node", async () => {
    const req = requestEnrollment({
      address: "10.20.1.91:8443",
      attestation: { nodeId: "nid-rej", tpm: "TPM · sealed" },
      csr: { keyType: "ECDSA P-384", subjectCn: "ACME Issuing CA REJ" },
      parentCn: "ACME Intermediate CA G1",
      proposedName: "acme-issuing-rej",
      role: "issuing",
    });
    await rejectEnrollment(req.id, "failed attestation");
    expect(getEnrollment(req.id)?.status).toBe("REJECTED");
    expect(getEnrollment(req.id)?.rejectionReason).toBe("failed attestation");
    expect(getNode("acme-issuing-rej")).toBeUndefined();
  });
});

const protoRequest = (overrides: Partial<ProtoEnrollmentRequest> = {}): ProtoEnrollmentRequest =>
  ({
    address: "10.20.1.80:8443",
    admittedNodeName: "",
    attestationNodeId: "nid-7f3a",
    attestationSummary: "TPM · sealed",
    csrKeyType: "ECDSA P-384",
    csrSubjectCn: "ACME Issuing CA G4",
    id: "enr-0001",
    kind: "LINK",
    parentCn: "ACME Intermediate CA G1",
    pinnedKeySha256: "ab12cd34",
    proposedName: "acme-issuing-04",
    rejectionReason: "",
    requestedAt: "2026-07-01T00:00:00.000Z",
    role: "issuing",
    status: "PENDING",
    ...overrides,
  }) as ProtoEnrollmentRequest;

describe("fromProtoRequest", () => {
  it("maps kind and pinnedKeySha256", () => {
    const req = fromProtoRequest(protoRequest({ kind: "LINK", pinnedKeySha256: "ab12cd34" }));
    expect(req.kind).toBe("LINK");
    expect(req.pinnedKeySha256).toBe("ab12cd34");
  });

  it("defaults kind to SUBORDINATE when the proto field is empty (back-compat)", () => {
    const req = fromProtoRequest(protoRequest({ kind: "" }));
    expect(req.kind).toBe("SUBORDINATE");
  });

  it("defaults kind to SUBORDINATE when the proto field is unrecognized", () => {
    const req = fromProtoRequest(protoRequest({ kind: "BOGUS" }));
    expect(req.kind).toBe("SUBORDINATE");
  });

  it("leaves pinnedKeySha256 undefined when the proto field is empty", () => {
    const req = fromProtoRequest(protoRequest({ pinnedKeySha256: "" }));
    expect(req.pinnedKeySha256).toBeUndefined();
  });
});

describe("enrollment store (live)", () => {
  beforeEach(() => {
    mode = "live";
    listEnrollments.mockReset().mockResolvedValue({ items: [] });
    createEnrollmentRpc.mockReset().mockResolvedValue({});
    approveEnrollmentRpc.mockReset().mockResolvedValue({});
    rejectEnrollmentRpc.mockReset().mockResolvedValue({});
  });

  it("approveEnrollment(id, link) calls the RPC with {id, ...link} then refreshes", async () => {
    const link = {
      adminCertPem: "cert",
      adminKeyPem: "key",
      caPem: "ca",
      nodeEndpoint: "10.0.0.5:9443",
    };
    listEnrollments.mockResolvedValue({ items: [protoRequest({ status: "APPROVED" })] });
    await approveEnrollment("enr-0001", link);
    expect(approveEnrollmentRpc).toHaveBeenCalledWith({ id: "enr-0001", ...link });
    expect(listEnrollments).toHaveBeenCalled();
  });

  it("approveEnrollment(id) with no link calls the RPC with just {id}", async () => {
    await approveEnrollment("enr-0001");
    expect(approveEnrollmentRpc).toHaveBeenCalledWith({ id: "enr-0001" });
  });

  it("rejectEnrollment(id, reason) calls the RPC with {id, reason} then refreshes", async () => {
    listEnrollments.mockResolvedValue({ items: [protoRequest({ status: "REJECTED" })] });
    await rejectEnrollment("enr-0001", "bad attestation");
    expect(rejectEnrollmentRpc).toHaveBeenCalledWith({ id: "enr-0001", reason: "bad attestation" });
    expect(listEnrollments).toHaveBeenCalled();
  });

  it("createEnrollment(draft) calls the RPC with the draft then refreshes", async () => {
    const draft = {
      adminCertPem: "cert",
      adminKeyPem: "key",
      caPem: "ca",
      kind: "LINK" as const,
      nodeEndpoint: "10.0.0.5:9443",
    };
    await createEnrollment(draft);
    expect(createEnrollmentRpc).toHaveBeenCalledWith(draft);
    expect(listEnrollments).toHaveBeenCalled();
  });

  it("propagates RPC errors instead of swallowing them", async () => {
    approveEnrollmentRpc.mockRejectedValue(new Error("manager unreachable"));
    await expect(approveEnrollment("enr-0001")).rejects.toThrow("manager unreachable");
  });
});
