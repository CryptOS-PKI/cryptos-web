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

import { Code, ConnectError } from "@connectrpc/connect";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperatorCredentialRow } from "@/lib/operators";

import { OperatorDenyDialog } from "@/components/operator-deny-dialog";
import * as operators from "@/lib/operators";

const target: OperatorCredentialRow = {
  commonName: "bob@example.org",
  crlRevoked: false,
  denylisted: false,
  email: "bob@example.org",
  firstSeenAt: "",
  fullName: "Bob Example",
  issuerSha256: "ab".repeat(32),
  kind: "requested",
  lastSeenAt: "",
  level: "operator",
  notAfter: "2027-01-01T00:00:00Z",
  revoked: false,
  serialHex: "0A:0B",
};

afterEach(() => vi.restoreAllMocks());

describe("OperatorDenyDialog", () => {
  it("offers reason codes 0 to 10 except 7", () => {
    render(<OperatorDenyDialog credential={target} onClose={vi.fn()} onDenied={vi.fn()} />);
    const values = Array.from(
      (screen.getByLabelText(/reason/i) as HTMLSelectElement).options,
      (o) => Number(o.value),
    );
    expect(values).toHaveLength(10);
    expect(values).toEqual(expect.arrayContaining([0, 1, 2, 3, 4, 5, 6, 8, 9, 10]));
  });

  it("warns before and after that the CA is not touched", async () => {
    const deny = vi.spyOn(operators, "denyOperatorCredential").mockResolvedValue({
      issuerSha256: target.issuerSha256,
      revokedAt: "2026-09-30T12:00:00Z",
      serialHex: target.serialHex,
      warnings: ["Also revoke this certificate at your CA and publish a new CRL."],
    });
    const onDenied = vi.fn();
    render(<OperatorDenyDialog credential={target} onClose={vi.fn()} onDenied={onDenied} />);
    expect(screen.getByRole("note").textContent).toMatch(/revoke .* at your CA/i);

    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: "left the team" } });
    fireEvent.click(screen.getByRole("button", { name: /deny at the fleet manager/i }));

    await waitFor(() =>
      expect(deny).toHaveBeenCalledWith({
        issuerSha256: target.issuerSha256,
        note: "left the team",
        reasonCode: 9,
        serialHex: target.serialHex,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/publish a new CRL/);
    expect(onDenied).toHaveBeenCalled();
  });

  it("explains a refusal by its code", async () => {
    vi.spyOn(operators, "denyOperatorCredential").mockRejectedValue(
      new ConnectError("x", Code.FailedPrecondition, {
        "x-cryptos-error-code": "1603",
        "x-cryptos-error-reason": "DATABASE_REQUIRED",
      }),
    );
    render(<OperatorDenyDialog credential={target} onClose={vi.fn()} onDenied={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /deny at the fleet manager/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Postgres/);
  });
});
