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

import type { ReactNode } from "react";

import { Code, ConnectError } from "@connectrpc/connect";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CredentialRequestRow, OperatorCredentialRow } from "@/lib/operators";

import { OperatorsPage } from "@/pages/operators";

const useAuth = vi.fn();
vi.mock("@/context/auth", () => ({ useAuth: () => useAuth() }));

const row = (over: Partial<OperatorCredentialRow>): OperatorCredentialRow => ({
  commonName: "a@example.org",
  crlRevoked: false,
  denylisted: false,
  email: "a@example.org",
  firstSeenAt: "",
  fullName: "",
  issuerSha256: "ab".repeat(32),
  kind: "requested",
  lastSeenAt: "",
  level: "operator",
  notAfter: "2027-01-01T00:00:00Z",
  revoked: false,
  serialHex: "01",
  ...over,
});

const credentials = [
  row({
    commonName: "admin@example.org",
    kind: "first_admin",
    lastSeenAt: "2026-09-30T09:00:00Z",
    level: "admin",
    serialHex: "3A:7F",
  }),
  row({
    commonName: "denied@example.org",
    denylisted: true,
    kind: "recorded",
    revoked: true,
    serialHex: "DE:AD",
  }),
  row({
    commonName: "crl@example.org",
    crlRevoked: true,
    kind: "observed",
    revoked: true,
    serialHex: "0B:AD",
  }),
  row({ commonName: "legacy@example.org", issuerSha256: "", kind: "legacy_node", serialHex: "99" }),
];

const pendingRequest: CredentialRequestRow = {
  completedSerial: "",
  createdAt: "2026-09-29T14:00:00Z",
  createdByCn: "admin@example.org",
  csrPem: "-----BEGIN CERTIFICATE REQUEST-----",
  email: "new@example.org",
  expiresAt: "2026-10-29T14:00:00Z",
  fullName: "New Person",
  id: "req-1",
  level: "viewer",
  state: "pending",
};

const lib = vi.hoisted(() => ({
  cancelCredentialRequest: vi.fn(),
  listCredentialRequests: vi.fn(),
  listOperatorCredentials: vi.fn(),
}));
vi.mock("@/lib/operators", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/operators")>()),
  ...lib,
}));

// The dialogs have their own tests. The stubs expose the props the page hands
// them, so the page test can check the wiring.
const dialogs = vi.hoisted(() => ({
  complete: vi.fn(),
  deny: vi.fn(),
  request: vi.fn(),
}));
vi.mock("@/components/credential-request-wizard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/credential-request-wizard")>()),
  CredentialRequestWizard: (props: {
    onCreated: (id: string, backup?: Uint8Array) => void;
  }): ReactNode => {
    dialogs.request(props);
    return (
      <button onClick={() => props.onCreated("req-1", new Uint8Array([7]))} type="button">
        stub-create
      </button>
    );
  },
}));
vi.mock("@/components/credential-complete-dialog", () => ({
  CredentialCompleteDialog: (props: unknown): ReactNode => {
    dialogs.complete(props);
    return <p>stub-complete</p>;
  },
}));
vi.mock("@/components/operator-deny-dialog", () => ({
  OperatorDenyDialog: (props: unknown): ReactNode => {
    dialogs.deny(props);
    return <p>stub-deny</p>;
  },
}));

const admin = { commonName: "admin@example.org", level: "admin", serial: "3A:7F" };

beforeEach(() => {
  vi.clearAllMocks();
  lib.listOperatorCredentials.mockResolvedValue(credentials);
  lib.listCredentialRequests.mockResolvedValue([pendingRequest]);
  lib.cancelCredentialRequest.mockImplementation(async () => {});
});

describe("OperatorsPage credentials", () => {
  it("shows kind, issuer, denylisted, CRL-revoked and last seen for each credential", async () => {
    useAuth.mockReturnValue({ operator: admin });
    render(<OperatorsPage />);
    await screen.findByText("admin@example.org");
    for (const header of ["Kind", "Issuer", "Denylisted", "CRL", "Last seen"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const denied = screen.getByText("denied@example.org").closest("tr") as HTMLElement;
    expect(within(denied).getByText("recorded")).toBeInTheDocument();
    expect(within(denied).getByText("denylisted")).toBeInTheDocument();
    const crl = screen.getByText("crl@example.org").closest("tr") as HTMLElement;
    expect(within(crl).getByText("CRL-revoked")).toBeInTheDocument();
    const first = screen.getByText("admin@example.org").closest("tr") as HTMLElement;
    expect(within(first).getByText("AB:AB:AB:AB:AB:AB:AB:AB…")).toBeInTheDocument();
    expect(within(first).getByText("2026-09-30T09:00:00Z")).toBeInTheDocument();
  });

  it("lets an admin request, record, and deny live credentials only", async () => {
    useAuth.mockReturnValue({ operator: admin });
    render(<OperatorsPage />);
    await screen.findByText("admin@example.org");
    expect(screen.getByRole("button", { name: /request credential/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record certificate/i })).toBeInTheDocument();
    // Not the denylisted row and not the read-only legacy row.
    expect(screen.getAllByRole("button", { name: /^deny/i })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: /^deny/i })[0]);
    expect(await screen.findByText("stub-deny")).toBeInTheDocument();
    expect(dialogs.deny).toHaveBeenCalledWith(
      expect.objectContaining({ credential: credentials[0] }),
    );
  });

  it("shows the operator CA banners to an admin", async () => {
    useAuth.mockReturnValue({ operator: admin });
    render(<OperatorsPage />);
    const banners = await screen.findByRole("region", { name: /needs attention/i });
    expect(within(banners).getByText("CA revocations not observed")).toBeInTheDocument();
  });

  it("hides every action from a non-admin", async () => {
    useAuth.mockReturnValue({ operator: { ...admin, level: "operator" } });
    render(<OperatorsPage />);
    await screen.findByText("admin@example.org");
    expect(screen.queryByRole("button", { name: /request credential/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^deny/i })).not.toBeInTheDocument();
  });

  it("explains an empty list without saying the fleet has no operators", async () => {
    lib.listOperatorCredentials.mockResolvedValueOnce([]);
    useAuth.mockReturnValue({ operator: admin });
    render(<OperatorsPage />);
    await screen.findByText(/no operator credentials are recorded or seen yet/i);
    expect(screen.getByText(/admin@example.org/)).toBeInTheDocument();
  });
});

// ListOperatorCredentials refuses with 1400 only when the manager has no
// operator CA at all. That is a deployment state, not a failure.
describe("OperatorsPage without an operator CA", () => {
  it("shows the not-configured view instead of the refusal", async () => {
    lib.listOperatorCredentials.mockRejectedValueOnce(
      new ConnectError("refused (error 1400)", Code.FailedPrecondition, {
        "x-cryptos-error-code": "1400",
      }),
    );
    useAuth.mockReturnValue({ operator: admin });
    render(<OperatorsPage />);
    await screen.findByText(/no operator CA is configured/i);
    expect(screen.getByText("operatorCAPath")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /request credential/i })).not.toBeInTheDocument();
  });

  it("still shows any other refusal as an error", async () => {
    lib.listOperatorCredentials.mockRejectedValueOnce(
      new ConnectError("The Fleet Manager refused this request (error 1100).", Code.Unavailable, {
        "x-cryptos-error-code": "1100",
      }),
    );
    useAuth.mockReturnValue({ operator: admin });
    render(<OperatorsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/error 1100/);
  });
});

describe("OperatorsPage pending requests", () => {
  it("lists pending requests and cancels one", async () => {
    useAuth.mockReturnValue({ operator: admin });
    render(<OperatorsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /pending requests/i }));
    const holder = await screen.findByText("new@example.org");
    const tr = holder.closest("tr") as HTMLElement;
    expect(within(tr).getByText("viewer")).toBeInTheDocument();
    fireEvent.click(within(tr).getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(lib.cancelCredentialRequest).toHaveBeenCalledWith("req-1"));
  });

  it("hands the key backup kept from the wizard to Complete", async () => {
    useAuth.mockReturnValue({ operator: admin });
    render(<OperatorsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /request credential/i }));
    fireEvent.click(screen.getByRole("button", { name: "stub-create" }));

    fireEvent.click(screen.getByRole("tab", { name: /pending requests/i }));
    const holder = await screen.findByText("new@example.org");
    const tr = holder.closest("tr") as HTMLElement;
    fireEvent.click(within(tr).getByRole("button", { name: /complete/i }));
    await screen.findByText("stub-complete");
    expect(dialogs.complete).toHaveBeenCalledWith(
      expect.objectContaining({ heldBackup: new Uint8Array([7]), request: pendingRequest }),
    );
  });

  it("gives no cancel or complete to a non-admin", async () => {
    useAuth.mockReturnValue({ operator: { ...admin, level: "viewer" } });
    render(<OperatorsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /pending requests/i }));
    await screen.findByText("new@example.org");
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete/i })).not.toBeInTheDocument();
  });
});
