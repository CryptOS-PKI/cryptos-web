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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IssueForm } from "@/components/issue-form";
import { __resetCerts } from "@/lib/certs";
import { mockNodes } from "@/lib/mock";
import { __resetProfiles } from "@/lib/profiles";

const issuingNode = mockNodes.find((n) => n.name === "acme-issuing-01")!;

const generateLeafKeyAndCSR = vi.fn();
const exportEncryptedKey = vi.fn();
const generateStrongPassphrase = vi.fn();

vi.mock("@/lib/crypto/leaf-key", () => ({
  exportEncryptedKey: (...args: unknown[]) => exportEncryptedKey(...args),
  generateLeafKeyAndCSR: (...args: unknown[]) => generateLeafKeyAndCSR(...args),
  generateStrongPassphrase: () => generateStrongPassphrase(),
  MIN_PASSPHRASE_LENGTH: 18,
  toPemEncryptedKey: () =>
    "-----BEGIN ENCRYPTED PRIVATE KEY-----\nx\n-----END ENCRYPTED PRIVATE KEY-----\n",
}));

const fleetMode = vi.fn(() => "mock" as string);
vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => fleetMode() }));

const issueCert = vi.fn();
vi.mock("@/lib/certs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/certs")>();
  return { ...actual, issueCert: (...args: unknown[]) => issueCert(...args) };
});

describe("IssueForm profile picker", () => {
  beforeEach(() => {
    __resetCerts();
    __resetProfiles();
    fleetMode.mockReturnValue("mock");
    issueCert.mockImplementation((_node: string, draft: { eku?: string[]; profile?: string }) =>
      Promise.resolve({ eku: draft.eku ?? [], profile: draft.profile, serial: "ABCD1234" }),
    );
  });

  it("passes the selected profile's EKU and name to issueCert", async () => {
    const onIssued = vi.fn();
    render(<IssueForm node={issuingNode} onIssued={onIssued} />);
    fireEvent.change(screen.getByLabelText(/profile/i), {
      target: { value: "TLS Server (LDAPS)" },
    });
    fireEvent.change(screen.getByLabelText(/subject cn/i), {
      target: { value: "ldap.acme.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^issue$/i }));
    await waitFor(() =>
      expect(issueCert).toHaveBeenCalledWith(
        "acme-issuing-01",
        expect.objectContaining({ eku: ["server_auth"], profile: "TLS Server (LDAPS)" }),
      ),
    );
    await waitFor(() => expect(onIssued).toHaveBeenCalled());
  });
});

describe("IssueForm live keygen and guarded export", () => {
  const fakePrivateKey = { extractable: true } as unknown as CryptoKey;

  beforeEach(() => {
    __resetCerts();
    __resetProfiles();
    fleetMode.mockReturnValue("live");
    issueCert.mockResolvedValue({
      eku: [],
      issuerNodeName: "acme-issuing-01",
      serial: "ABCD1234",
      subjectCn: "web.acme.example",
    });
    generateLeafKeyAndCSR.mockResolvedValue({
      csrDer: new Uint8Array([1, 2, 3]),
      privateKey: fakePrivateKey,
    });
    exportEncryptedKey.mockResolvedValue(new Uint8Array([9, 9, 9]));
    generateStrongPassphrase.mockReturnValue("Generated-Strong-Passphrase-123456");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("generates the key + CSR on submit and issues with the resulting CSR", async () => {
    const onIssued = vi.fn();
    render(<IssueForm node={issuingNode} onIssued={onIssued} />);
    fireEvent.change(screen.getByLabelText(/subject cn/i), {
      target: { value: "web.acme.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^issue$/i }));

    await waitFor(() => expect(generateLeafKeyAndCSR).toHaveBeenCalled());
    expect(generateLeafKeyAndCSR).toHaveBeenCalledWith(
      expect.objectContaining({ subjectCn: "web.acme.example" }),
    );
    await waitFor(() => expect(onIssued).toHaveBeenCalled());
  });

  it("gates the export behind a >=18-char passphrase and a saved-confirmation", async () => {
    render(<IssueForm node={issuingNode} onIssued={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/subject cn/i), {
      target: { value: "web.acme.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^issue$/i }));
    await waitFor(() => expect(screen.getByLabelText(/^Passphrase/i)).toBeInTheDocument());

    // A short passphrase leaves the confirm/export controls unavailable.
    fireEvent.change(screen.getByLabelText(/^Passphrase/i), { target: { value: "short" } });
    const savedConfirm = screen.getByLabelText(/saved the passphrase/i) as HTMLInputElement;
    expect(savedConfirm).toBeDisabled();
    expect(exportEncryptedKey).not.toHaveBeenCalled();

    // A >=18-char passphrase plus the saved-confirmation unlocks the export.
    fireEvent.change(screen.getByLabelText(/^Passphrase/i), {
      target: { value: "a-long-enough-passphrase-value" },
    });
    fireEvent.click(screen.getByLabelText(/saved the passphrase/i));
    fireEvent.click(screen.getByRole("button", { name: /export private key/i }));
    await waitFor(() => expect(exportEncryptedKey).toHaveBeenCalled());
    expect(exportEncryptedKey).toHaveBeenCalledWith(
      fakePrivateKey,
      "a-long-enough-passphrase-value",
    );
  });

  it("fills a generated strong passphrase on demand", async () => {
    render(<IssueForm node={issuingNode} onIssued={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/subject cn/i), {
      target: { value: "web.acme.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^issue$/i }));
    await waitFor(() => expect(screen.getByLabelText(/^Passphrase/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /generate strong passphrase/i }));
    expect(generateStrongPassphrase).toHaveBeenCalled();
    expect((screen.getByLabelText(/^Passphrase/i) as HTMLInputElement).value).toBe(
      "Generated-Strong-Passphrase-123456",
    );
  });
});
