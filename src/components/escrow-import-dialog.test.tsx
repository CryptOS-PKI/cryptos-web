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

import { EscrowImportDialog } from "@/components/escrow-import-dialog";

const importCAKey = vi.fn();
vi.mock("@/lib/escrow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/escrow")>();
  return { ...actual, importCAKey: (...args: unknown[]) => importCAKey(...args) };
});

const STRONG = "correct-horse-battery-staple";

const selectFile = () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const file = new File([bytes], "backup.enc", { type: "application/octet-stream" });
  // jsdom's File does not implement arrayBuffer(); provide it so the dialog can
  // read the selected file the way a real browser would.
  Object.defineProperty(file, "arrayBuffer", { value: () => Promise.resolve(bytes.buffer) });
  fireEvent.change(screen.getByLabelText(/backup envelope file/i), { target: { files: [file] } });
};

const importButton = () => screen.getByRole("button", { name: /import key/i });

describe("EscrowImportDialog", () => {
  beforeEach(() => {
    importCAKey.mockReset();
    importCAKey.mockResolvedValue({ issuerCn: "ACME Root CA", subjectCn: "ACME Sub CA" });
  });

  it("requires an uploaded envelope and a >= 18 passphrase before enabling Import", async () => {
    render(<EscrowImportDialog nodeName="acme-fresh-01" onClose={vi.fn()} />);
    expect(importButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/passphrase/i), { target: { value: STRONG } });
    expect(importButton()).toBeDisabled(); // no file yet

    selectFile();
    await waitFor(() => expect(importButton()).toBeEnabled());
  });

  it("calls importCAKey and shows the restored identity", async () => {
    render(<EscrowImportDialog nodeName="acme-fresh-01" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/passphrase/i), { target: { value: STRONG } });
    selectFile();
    await waitFor(() => expect(importButton()).toBeEnabled());
    fireEvent.click(importButton());

    await waitFor(() =>
      expect(importCAKey).toHaveBeenCalledWith("acme-fresh-01", expect.any(Uint8Array), STRONG),
    );
    await waitFor(() => expect(screen.getByText(/ACME Sub CA/)).toBeInTheDocument());
  });

  it("surfaces the node's already-has-identity error inline", async () => {
    importCAKey.mockRejectedValue(
      new Error('node "acme-fresh-01" already has a CA identity; import only onto a fresh node'),
    );
    render(<EscrowImportDialog nodeName="acme-fresh-01" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/passphrase/i), { target: { value: STRONG } });
    selectFile();
    await waitFor(() => expect(importButton()).toBeEnabled());
    fireEvent.click(importButton());

    await waitFor(() => expect(screen.getByText(/already has a CA identity/i)).toBeInTheDocument());
  });
});
