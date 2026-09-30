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
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OperatorLevel } from "@/context/auth";

import {
  __resetEnrollments,
  approveEnrollment,
  createEnrollment,
  enrollmentsList,
} from "@/lib/enrollment";
import { __resetNodes } from "@/lib/nodes";
import { EnrollmentPage } from "@/pages/enrollment";

const mockOperator = vi.fn<() => { level: OperatorLevel } | null>(() => ({ level: "admin" }));
vi.mock("@/context/auth", () => ({
  useAuth: () => ({ operator: mockOperator(), status: "authenticated" }),
}));

vi.mock("@/lib/enrollment", async () => {
  const actual = await vi.importActual<typeof import("@/lib/enrollment")>("@/lib/enrollment");
  return { ...actual, createEnrollment: vi.fn(actual.createEnrollment) };
});

describe("EnrollmentPage", () => {
  beforeEach(() => {
    __resetNodes();
    __resetEnrollments();
    mockOperator.mockReturnValue({ level: "admin" });
    vi.mocked(createEnrollment).mockClear();
  });

  it("lists a pending request linking to its detail", () => {
    render(
      <MemoryRouter>
        <EnrollmentPage />
      </MemoryRouter>,
    );
    const first = enrollmentsList().find((r) => r.status === "PENDING")!;
    expect(screen.getByRole("link", { name: new RegExp(first.proposedName) })).toHaveAttribute(
      "href",
      `/enrollment/${first.id}`,
    );
  });

  it("shows a kind badge per row", () => {
    render(
      <MemoryRouter>
        <EnrollmentPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("SUBORDINATE").length).toBeGreaterThan(0);
  });

  it("simulate incoming request adds a pending row", () => {
    render(
      <MemoryRouter>
        <EnrollmentPage />
      </MemoryRouter>,
    );
    const before = enrollmentsList().length;
    fireEvent.click(screen.getByRole("button", { name: /simulate/i }));
    expect(enrollmentsList().length).toBe(before + 1);
  });

  it("narrows to PENDING via the Status facet, hiding an APPROVED row", () => {
    approveEnrollment("enr-0001"); // parent G1 established -> approvable
    const approved = enrollmentsList().find((r) => r.status === "APPROVED")!;
    const pending = enrollmentsList().find((r) => r.status === "PENDING")!;

    render(
      <MemoryRouter>
        <EnrollmentPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(approved.proposedName)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter Status"), { target: { value: "PENDING" } });

    expect(screen.getByText(pending.proposedName)).toBeInTheDocument();
    expect(screen.queryByText(approved.proposedName)).not.toBeInTheDocument();
  });

  it("disables New enrollment for a viewer", () => {
    mockOperator.mockReturnValue({ level: "viewer" });
    render(
      <MemoryRouter>
        <EnrollmentPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /new enrollment/i })).toBeDisabled();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it("submits a SUBORDINATE create draft", async () => {
    render(
      <MemoryRouter>
        <EnrollmentPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^new enrollment$/i }));
    fireEvent.change(screen.getByLabelText(/child node/i), {
      target: { value: "acme-issuing-99" },
    });
    fireEvent.change(screen.getByLabelText(/parent cn/i), {
      target: { value: "ACME Intermediate CA G1" },
    });
    fireEvent.change(screen.getByLabelText(/profile/i), { target: { value: "issuing-ca" } });
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() =>
      expect(createEnrollment).toHaveBeenCalledWith({
        childNode: "acme-issuing-99",
        kind: "SUBORDINATE",
        parentCn: "ACME Intermediate CA G1",
        profile: "issuing-ca",
      }),
    );
  });

  it("submits a LINK create draft with its material", async () => {
    render(
      <MemoryRouter>
        <EnrollmentPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^new enrollment$/i }));
    fireEvent.change(screen.getByLabelText(/^kind$/i), { target: { value: "LINK" } });
    fireEvent.change(screen.getByLabelText(/node endpoint/i), {
      target: { value: "10.20.5.10:8443" },
    });
    fireEvent.change(screen.getByLabelText(/admin cert/i), { target: { value: "cert-pem" } });
    fireEvent.change(screen.getByLabelText(/admin key/i), { target: { value: "key-pem" } });
    fireEvent.change(screen.getByLabelText(/^ca \(pem\)$/i), { target: { value: "ca-pem" } });
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() =>
      expect(createEnrollment).toHaveBeenCalledWith({
        adminCertPem: "cert-pem",
        adminKeyPem: "key-pem",
        caPem: "ca-pem",
        kind: "LINK",
        nodeEndpoint: "10.20.5.10:8443",
      }),
    );
  });
});
