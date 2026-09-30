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

import type { ReactNode } from "react";

import { Code, ConnectError } from "@connectrpc/connect";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OperatorsPage } from "@/pages/operators";

const useAuth = vi.fn();
vi.mock("@/context/auth", () => ({ useAuth: () => useAuth() }));

vi.mock("@/lib/operators", () => ({
  listOperatorCredentials: vi.fn().mockResolvedValue([
    {
      commonName: "operator@acme.example",
      level: "admin",
      notAfter: "2027-01-01T00:00:00Z",
      revoked: false,
      serialHex: "3A:7F",
    },
    {
      commonName: "former@acme.example",
      level: "operator",
      notAfter: "2026-09-01T00:00:00Z",
      revoked: true,
      serialHex: "DE:AD",
    },
  ]),
}));

// The dialogs are covered by their own tests; stub them so the page test stays
// focused on listing and admin gating.
vi.mock("@/components/operator-issue-dialog", () => ({
  OperatorIssueDialog: (): ReactNode => null,
}));
vi.mock("@/components/operator-revoke-dialog", () => ({
  OperatorRevokeDialog: (): ReactNode => null,
}));

describe("OperatorsPage", () => {
  it("lists the issued credentials with their level and status", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    render(<OperatorsPage />);
    await waitFor(() => expect(screen.getByText("operator@acme.example")).toBeInTheDocument());
    expect(screen.getByText("former@acme.example")).toBeInTheDocument();
    expect(screen.getByText("revoked")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("shows the Issue action to an admin", async () => {
    useAuth.mockReturnValue({ operator: { level: "admin" } });
    render(<OperatorsPage />);
    await waitFor(() => expect(screen.getByText("operator@acme.example")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /issue operator/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /revoke/i }).length).toBe(1); // only the active row
  });

  it("hides the Issue and Revoke actions from a non-admin", async () => {
    useAuth.mockReturnValue({ operator: { level: "operator" } });
    render(<OperatorsPage />);
    await waitFor(() => expect(screen.getByText("operator@acme.example")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /issue operator/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke/i })).not.toBeInTheDocument();
  });
});

// "No operator credentials" read as "this fleet has no operators" while the
// reader was signed in as one, on a deployment whose credential was minted
// outside the manager (#85).
describe("OperatorsPage empty state", () => {
  it("explains what it can and cannot list, and shows who you are", async () => {
    const { listOperatorCredentials } = await import("@/lib/operators");
    vi.mocked(listOperatorCredentials).mockResolvedValueOnce([]);
    useAuth.mockReturnValue({
      operator: { commonName: "operator@example.org", level: "admin", serial: "0A:BC" },
    });

    render(<OperatorsPage />);

    await waitFor(() => {
      expect(screen.getByText(/has not issued any operator credentials/i)).toBeInTheDocument();
    });
    // The distinction that matters: externally minted credentials cannot be
    // listed, which is different from there being none.
    expect(screen.getByText(/minted outside it/i)).toBeInTheDocument();
    // And the reader is an operator, so saying otherwise is plainly wrong.
    expect(screen.getByText(/operator@example.org/)).toBeInTheDocument();
    expect(screen.getByText(/operator_ca_node/)).toBeInTheDocument();
  });
});

// With no operator_ca_node the manager refuses the list with error 1400. That
// is a deployment state, not a failure, so the page explains it instead of
// showing the generic refusal.
describe("OperatorsPage without an operator-CA node", () => {
  const refusal =
    "The Fleet Manager refused this request (error 1400). Quote that code when reporting it.";

  it("shows the not-configured view naming operator_ca_node, not the refusal", async () => {
    const { listOperatorCredentials } = await import("@/lib/operators");
    vi.mocked(listOperatorCredentials).mockRejectedValueOnce(
      new ConnectError(refusal, Code.FailedPrecondition, { "x-cryptos-error-code": "1400" }),
    );
    useAuth.mockReturnValue({
      operator: { commonName: "operator@example.org", level: "admin", serial: "0A:BC" },
    });

    render(<OperatorsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no operator-CA node is configured/i)).toBeInTheDocument();
    });
    expect(screen.getByText("operator_ca_node")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/refused this request/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/has not issued any operator credentials/i)).not.toBeInTheDocument();
    // Issuing would only be refused with the same code.
    expect(screen.queryByRole("button", { name: /issue operator/i })).not.toBeInTheDocument();
  });

  it("still shows any other refusal as an error", async () => {
    const { listOperatorCredentials } = await import("@/lib/operators");
    vi.mocked(listOperatorCredentials).mockRejectedValueOnce(
      new ConnectError("The Fleet Manager refused this request (error 1100).", Code.Unavailable, {
        "x-cryptos-error-code": "1100",
      }),
    );
    useAuth.mockReturnValue({ operator: { level: "admin" } });

    render(<OperatorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/error 1100/);
    });
    expect(screen.queryByText(/no operator-CA node is configured/i)).not.toBeInTheDocument();
  });
});
