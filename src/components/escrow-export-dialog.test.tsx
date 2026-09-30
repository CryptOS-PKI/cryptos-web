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

import { EscrowExportDialog } from "@/components/escrow-export-dialog";

const exportCAKey = vi.fn();
vi.mock("@/lib/escrow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/escrow")>();
  return {
    ...actual,
    exportCAKey: (...args: unknown[]) => exportCAKey(...args),
    generateStrongPassphrase: () => "Generated-Strong-Passphrase-1234",
  };
});

const STRONG = "correct-horse-battery-staple";

const exportButton = () => screen.getByRole("button", { name: /export key/i });

describe("EscrowExportDialog", () => {
  beforeEach(() => {
    exportCAKey.mockReset();
    exportCAKey.mockResolvedValue(new Uint8Array([1, 2, 3]));
    // Stub the download side effects so the click does not touch the DOM/URL.
    globalThis.URL.createObjectURL = vi.fn(() => "blob:stub");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("keeps Export disabled until both a >= 18 passphrase and the typed confirmation are present", () => {
    render(<EscrowExportDialog nodeName="acme-root-01" onClose={vi.fn()} />);
    expect(exportButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/passphrase/i), { target: { value: STRONG } });
    expect(exportButton()).toBeDisabled(); // still no typed confirmation

    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "acme-root-01" } });
    expect(exportButton()).toBeEnabled();
  });

  it("rejects a short passphrase in-UI and never enables Export", () => {
    render(<EscrowExportDialog nodeName="acme-root-01" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/passphrase/i), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "EXPORT" } });
    expect(screen.getByText(/at least 18 characters/i)).toBeInTheDocument();
    expect(exportButton()).toBeDisabled();
  });

  it("the generate button fills a passphrase that satisfies the length guard", () => {
    render(<EscrowExportDialog nodeName="acme-root-01" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /generate strong passphrase/i }));
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "EXPORT" } });
    expect(exportButton()).toBeEnabled();
  });

  it("on confirm calls exportCAKey and triggers a download", async () => {
    render(<EscrowExportDialog nodeName="acme-root-01" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/passphrase/i), { target: { value: STRONG } });
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "acme-root-01" } });
    fireEvent.click(exportButton());

    await waitFor(() => expect(exportCAKey).toHaveBeenCalledWith("acme-root-01", STRONG));
    await waitFor(() => expect(globalThis.URL.createObjectURL).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/backup downloaded/i)).toBeInTheDocument());
  });

  it("surfaces an export error inline", async () => {
    exportCAKey.mockRejectedValue(new Error("node refused export; TPM-backed"));
    render(<EscrowExportDialog nodeName="acme-root-01" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/passphrase/i), { target: { value: STRONG } });
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "EXPORT" } });
    fireEvent.click(exportButton());

    await waitFor(() => expect(screen.getByText(/TPM-backed/i)).toBeInTheDocument());
  });
});
