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

import { KeyBackupStep } from "@/components/key-backup-step";

const downloadText = vi.fn();
vi.mock("@/lib/download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/download")>()),
  downloadText: (...a: unknown[]) => downloadText(...a),
}));

const passphraseShown = async (): Promise<string> => {
  const el = await screen.findByLabelText(/key backup passphrase/i, {}, { timeout: 10_000 });
  return el.textContent ?? "";
};

describe("KeyBackupStep", () => {
  beforeEach(() => downloadText.mockReset());

  it("won't continue until the key backup is downloaded", async () => {
    const onBackedUp = vi.fn();
    render(<KeyBackupStep email="alice@example.org" level="admin" onBackedUp={onBackedUp} />);
    const passphrase = await passphraseShown();
    expect(passphrase).toHaveLength(24);

    const next = screen.getByRole("button", { name: /continue/i });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/saved the passphrase/i));
    expect(next).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /download key backup/i }));
    expect(downloadText).toHaveBeenCalledWith(
      "fleetos-admin-alice@example.org.key.pem",
      expect.stringMatching(/^-----BEGIN ENCRYPTED PRIVATE KEY-----/),
      "application/x-pem-file",
    );
    expect(next).toBeEnabled();

    fireEvent.click(next);
    await waitFor(() => expect(onBackedUp).toHaveBeenCalledTimes(1));
    const [{ backup, csrDer }] = onBackedUp.mock.calls[0] as [
      { backup: Uint8Array; csrDer: Uint8Array },
    ];
    expect(new TextDecoder().decode(backup)).toBe(downloadText.mock.calls[0][1]);
    expect(csrDer[0]).toBe(0x30);
  }, 20_000);

  it("shows the passphrase once: a remount makes a new key and never shows the old one", async () => {
    const first = render(
      <KeyBackupStep email="alice@example.org" level="operator" onBackedUp={vi.fn()} />,
    );
    const old = await passphraseShown();
    first.unmount();
    expect(screen.queryByText(old)).not.toBeInTheDocument();

    render(<KeyBackupStep email="alice@example.org" level="operator" onBackedUp={vi.fn()} />);
    const fresh = await passphraseShown();
    expect(fresh).not.toBe(old);
    expect(screen.queryByText(old)).not.toBeInTheDocument();
  }, 20_000);

  it("keeps the passphrase out of storage", async () => {
    render(<KeyBackupStep email="alice@example.org" level="viewer" onBackedUp={vi.fn()} />);
    const passphrase = await passphraseShown();
    const stored = [
      ...Object.values(localStorage),
      ...Object.values(sessionStorage),
      document.cookie,
    ].join("\n");
    expect(stored).not.toContain(passphrase);
  }, 20_000);
});
