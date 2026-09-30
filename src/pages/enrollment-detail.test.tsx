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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OperatorLevel } from "@/context/auth";
import type { EnrollmentRequest } from "@/lib/enrollment";

import { __resetCerts } from "@/lib/certs";
import { __resetEnrollments, approveEnrollment, getEnrollment } from "@/lib/enrollment";
import { __resetNodes, getNode } from "@/lib/nodes";
import { EnrollmentDetailPage } from "@/pages/enrollment-detail";

const mockOperator = vi.fn<() => { level: OperatorLevel } | null>(() => ({ level: "admin" }));
vi.mock("@/context/auth", () => ({
  useAuth: () => ({ operator: mockOperator(), status: "authenticated" }),
}));

// A LINK fixture, kept local to this test file rather than added to the mock
// seed data: the mock queue models the SUBORDINATE CSR flow only (LINK create
// is a live/live-auth-only path per lib/enrollment), so enrollment.test.ts
// asserts the seed is all SUBORDINATE. `getEnrollment` is patched to serve
// this fixture for one id and delegate to the real store for every other id,
// so canApprove/approveEnrollment/rejectEnrollment stay real.
const LINK_FIXTURE: EnrollmentRequest = {
  address: "10.20.5.10:8443",
  attestation: { nodeId: "", tpm: "" },
  csr: { keyType: "", subjectCn: "" },
  id: "enr-link-01",
  kind: "LINK",
  parentCn: "ACME Intermediate CA G1", // ESTABLISHED intermediate -> canApprove ok
  pinnedKeySha256: "sha256:deadbeef",
  proposedName: "acme-link-node-01",
  requestedAt: "2026-07-08T00:00:00.000Z",
  role: "issuing",
  status: "PENDING",
};

vi.mock("@/lib/enrollment", async () => {
  const actual = await vi.importActual<typeof import("@/lib/enrollment")>("@/lib/enrollment");
  return {
    ...actual,
    approveEnrollment: vi.fn(actual.approveEnrollment),
    getEnrollment: (id: string) =>
      id === LINK_FIXTURE.id ? LINK_FIXTURE : actual.getEnrollment(id),
  };
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<EnrollmentDetailPage />} path="/enrollment/:id" />
        <Route element={<div>queue</div>} path="/enrollment" />
        <Route element={<div>node hub</div>} path="/nodes/:name" />
      </Routes>
    </MemoryRouter>,
  );

describe("EnrollmentDetailPage", () => {
  beforeEach(() => {
    __resetNodes();
    __resetCerts();
    __resetEnrollments();
    mockOperator.mockReturnValue({ level: "admin" });
    vi.mocked(approveEnrollment).mockClear();
  });

  it("approves a capable SUBORDINATE request and admits the node", async () => {
    mockOperator.mockReturnValue({ level: "operator" });
    renderAt("/enrollment/enr-0001"); // parent G1 established -> approvable
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    await waitFor(() => expect(getEnrollment("enr-0001")?.status).toBe("APPROVED"));
    expect(getNode("acme-issuing-04")?.identityState).toBe("ESTABLISHED");
  });

  it("blocks approve when the parent cannot issue", () => {
    renderAt("/enrollment/enr-0003"); // parent G2 revoked
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeDisabled();
    expect(screen.getByText(/cannot issue/i)).toBeInTheDocument();
  });

  it("rejects with a reason and admits no node", async () => {
    renderAt("/enrollment/enr-0002");
    fireEvent.click(screen.getByRole("button", { name: /^reject$/i }));
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "bad attestation" } });
    fireEvent.click(screen.getByRole("button", { name: /^confirm reject$/i }));
    await waitFor(() => expect(getEnrollment("enr-0002")?.status).toBe("REJECTED"));
    expect(getNode("acme-intermediate-04")).toBeUndefined();
  });

  it("renders the attestation panel for a SUBORDINATE request", () => {
    renderAt("/enrollment/enr-0001");
    expect(screen.getByText("SUBORDINATE")).toBeInTheDocument();
    expect(screen.getByText(/TPM · sealed/)).toBeInTheDocument();
  });

  describe("operator level gating", () => {
    it("viewer: approve and reject are disabled with a read-only note", () => {
      mockOperator.mockReturnValue({ level: "viewer" });
      renderAt("/enrollment/enr-0001");
      expect(screen.getByRole("button", { name: /^approve$/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /^reject$/i })).toBeDisabled();
      expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    });

    it("operator: SUBORDINATE approve is enabled", () => {
      mockOperator.mockReturnValue({ level: "operator" });
      renderAt("/enrollment/enr-0001");
      expect(screen.getByRole("button", { name: /^approve$/i })).not.toBeDisabled();
    });

    it("operator: LINK approve is disabled with an admin-required note", () => {
      mockOperator.mockReturnValue({ level: "operator" });
      renderAt("/enrollment/enr-link-01");
      expect(screen.getByRole("button", { name: /^approve$/i })).toBeDisabled();
      expect(screen.getByText(/requires the admin level/i)).toBeInTheDocument();
    });

    it("admin: LINK approve is enabled and reveals the material form", () => {
      mockOperator.mockReturnValue({ level: "admin" });
      renderAt("/enrollment/enr-link-01");
      expect(screen.getByRole("button", { name: /^approve$/i })).not.toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
      expect(screen.getByText(/link approval material/i)).toBeInTheDocument();
    });
  });

  describe("LINK requests", () => {
    it("renders the attestation panel with pinnedKeySha256", () => {
      renderAt("/enrollment/enr-link-01");
      expect(screen.getByText("LINK")).toBeInTheDocument();
      expect(screen.getByText("sha256:deadbeef")).toBeInTheDocument();
      expect(screen.getByText(/tofu-pinned/i)).toBeInTheDocument();
    });

    it("submits the approval material to approveEnrollment", async () => {
      renderAt("/enrollment/enr-link-01");
      fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));

      fireEvent.change(screen.getByLabelText(/node endpoint/i), {
        target: { value: "10.20.5.10:8443" },
      });
      fireEvent.change(screen.getByLabelText(/admin cert/i), { target: { value: "cert-pem" } });
      fireEvent.change(screen.getByLabelText(/admin key/i), { target: { value: "key-pem" } });
      fireEvent.change(screen.getByLabelText(/^ca \(pem\)$/i), { target: { value: "ca-pem" } });
      fireEvent.click(screen.getByRole("button", { name: /submit & approve/i }));

      await waitFor(() =>
        expect(approveEnrollment).toHaveBeenCalledWith("enr-link-01", {
          adminCertPem: "cert-pem",
          adminKeyPem: "key-pem",
          caPem: "ca-pem",
          nodeEndpoint: "10.20.5.10:8443",
        }),
      );
    });
  });
});
