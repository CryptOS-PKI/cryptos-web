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
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OperatorIssueDialog } from "@/components/operator-issue-dialog";

const issueOperatorCredential = vi.fn();
vi.mock("@/lib/operators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/operators")>();
  return { ...actual, issueOperatorCredential: (...a: unknown[]) => issueOperatorCredential(...a) };
});

vi.mock("@/lib/crypto/leaf-key", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crypto/leaf-key")>();
  return {
    ...actual,
    generateLeafKeyAndCSR: vi.fn().mockResolvedValue({
      csrDer: new Uint8Array([1, 2, 3]),
      privateKey: {} as CryptoKey,
    }),
    generateStrongPassphrase: () => "Generated-Strong-Passphrase-1234",
  };
});

vi.mock("@/lib/crypto/pkcs12", () => ({
  assemblePkcs12: vi.fn().mockResolvedValue(new Uint8Array([0x30, 0x01])),
}));

const STRONG = "correct-horse-battery-staple";
const issueButton = () => screen.getByRole("button", { name: /issue and download/i });

describe("OperatorIssueDialog", () => {
  beforeEach(() => {
    issueOperatorCredential.mockReset();
    issueOperatorCredential.mockResolvedValue({ certDer: new Uint8Array([9]), serialHex: "0A:0B" });
    globalThis.URL.createObjectURL = vi.fn(() => "blob:stub");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("keeps Issue disabled until CN, a >= 18 passphrase, and the typed confirmation are present", () => {
    render(<OperatorIssueDialog onClose={vi.fn()} onIssued={vi.fn()} />);
    expect(issueButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/common name/i), { target: { value: "op@acme" } });
    fireEvent.change(screen.getByLabelText(/passphrase \(min/i), { target: { value: STRONG } });
    expect(issueButton()).toBeDisabled(); // still no typed confirmation

    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "ISSUE" } });
    expect(issueButton()).toBeEnabled();
  });

  it("rejects a short passphrase in-UI and never enables Issue", () => {
    render(<OperatorIssueDialog onClose={vi.fn()} onIssued={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/common name/i), { target: { value: "op@acme" } });
    fireEvent.change(screen.getByLabelText(/passphrase \(min/i), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "ISSUE" } });
    expect(screen.getByText(/at least 18 characters/i)).toBeInTheDocument();
    expect(issueButton()).toBeDisabled();
  });

  it("on confirm issues with the chosen level and downloads a PKCS#12", async () => {
    const onIssued = vi.fn();
    render(<OperatorIssueDialog onClose={vi.fn()} onIssued={onIssued} />);
    fireEvent.change(screen.getByLabelText(/common name/i), { target: { value: "op@acme" } });
    fireEvent.change(screen.getByLabelText(/access level/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/passphrase \(min/i), { target: { value: STRONG } });
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "op@acme" } });
    fireEvent.click(issueButton());

    await waitFor(() =>
      expect(issueOperatorCredential).toHaveBeenCalledWith(
        "op@acme",
        "admin",
        expect.any(Uint8Array),
      ),
    );
    await waitFor(() => expect(globalThis.URL.createObjectURL).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/PKCS#12 downloaded/i)).toBeInTheDocument());
    expect(onIssued).toHaveBeenCalled();
  });

  it("surfaces an issue error inline", async () => {
    issueOperatorCredential.mockRejectedValue(new Error("operator-admin profile is absent"));
    render(<OperatorIssueDialog onClose={vi.fn()} onIssued={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/common name/i), { target: { value: "op@acme" } });
    fireEvent.change(screen.getByLabelText(/passphrase \(min/i), { target: { value: STRONG } });
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "ISSUE" } });
    fireEvent.click(issueButton());

    await waitFor(() => expect(screen.getByText(/profile is absent/i)).toBeInTheDocument());
  });
});
