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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RenameNodeDialog } from "@/components/rename-node-dialog";
import { type Node } from "@/lib/mock";

const renameNode = vi.fn();
vi.mock("@/lib/nodes", () => ({
  renameNode: (...a: unknown[]) => renameNode(...a),
}));

const node: Node = {
  address: "10.20.0.11:8443",
  bootCount: 1,
  cn: "ACME Root CA G1",
  fleetManager: { linked: true },
  id: "0198c2ac-6e3f-7e3e-9b2b-9f6a7a9d2c31",
  identityState: "ESTABLISHED",
  issued: 0,
  issuer: "self-signed",
  name: "acme-root-01",
  revoked: 0,
  role: "root",
  tpm: "TPM · sealed",
  uptime: "1d 00h",
};

const nameField = () => screen.getByLabelText(/new name/i);
const renameButton = () => screen.getByRole("button", { name: /^rename$/i });

const renderDialog = (onRenamed = vi.fn(), onClose = vi.fn()) => {
  render(<RenameNodeDialog node={node} onClose={onClose} onRenamed={onRenamed} />);
  return { onClose, onRenamed };
};

describe("RenameNodeDialog", () => {
  beforeEach(() => {
    renameNode.mockReset();
    renameNode.mockImplementation((_n: Node, newName: string) => Promise.resolve(newName));
  });

  it("starts with the current name and keeps Rename enabled for an unchanged name", () => {
    renderDialog();
    expect(nameField()).toHaveValue("acme-root-01");
    expect(renameButton()).toBeEnabled();
  });

  it("disables Rename and shows the constraint for an invalid name", () => {
    renderDialog();
    fireEvent.change(nameField(), { target: { value: "Not Valid" } });
    expect(renameButton()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/lowercase/i);
  });

  it("disables Rename for an empty name", () => {
    renderDialog();
    fireEvent.change(nameField(), { target: { value: "" } });
    expect(renameButton()).toBeDisabled();
  });

  it("on confirm calls renameNode with the node and trimmed name, then reports the new name", async () => {
    const { onClose, onRenamed } = renderDialog();
    fireEvent.change(nameField(), { target: { value: "  acme-root-99  " } });
    fireEvent.click(renameButton());

    await waitFor(() => expect(renameNode).toHaveBeenCalledWith(node, "acme-root-99"));
    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith("acme-root-99"));
    expect(onClose).toHaveBeenCalled();
  });

  it("surfaces a refusal inline and leaves the dialog open", async () => {
    renameNode.mockRejectedValue(new Error("Another node already has that name."));
    const { onClose } = renderDialog();
    fireEvent.change(nameField(), { target: { value: "acme-intermediate-01" } });
    fireEvent.click(renameButton());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/already has that name/i),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes without renaming on Cancel", () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
    expect(renameNode).not.toHaveBeenCalled();
  });
});
