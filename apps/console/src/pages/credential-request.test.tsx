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

import "reflect-metadata";
import { X509CertificateGenerator } from "@peculiar/x509";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateBackupPassphrase, keyBackupPem } from "@/lib/crypto/key-backup";
import { CredentialRequestPage } from "@/pages/credential-request";

const { downloadBytes, downloadText, fleetClient } = vi.hoisted(() => ({
  downloadBytes: vi.fn(),
  downloadText: vi.fn(),
  fleetClient: vi.fn(),
}));
vi.mock("@/lib/download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/download")>()),
  downloadBytes: (...a: unknown[]) => downloadBytes(...a),
  downloadText: (...a: unknown[]) => downloadText(...a),
}));
vi.mock("@/lib/fleet/client", () => ({ fleetClient }));

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const network = {
  beacon: vi.fn(),
  fetch: vi.fn(),
  xhr: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", network.fetch);
  vi.spyOn(XMLHttpRequest.prototype, "open").mockImplementation(network.xhr);
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: network.beacon });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const expectNoNetwork = () => {
  expect(network.fetch).not.toHaveBeenCalled();
  expect(network.xhr).not.toHaveBeenCalled();
  expect(network.beacon).not.toHaveBeenCalled();
  expect(fleetClient).not.toHaveBeenCalled();
};

describe("CredentialRequestPage", () => {
  it("makes the key, backup and CSR entirely in the browser, with no network calls", async () => {
    render(<CredentialRequestPage />);
    fill(/full name/i, "Dana Example");
    fill(/^email/i, "Dana@Example.org");
    fill(/access level/i, "operator");
    fireEvent.click(screen.getByRole("button", { name: /make my key/i }));

    await screen.findByLabelText(
      /key backup passphrase/i,
      { selector: "code" },
      { timeout: 10_000 },
    );
    expect(screen.queryByLabelText("CSR", { selector: "pre" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /download key backup/i }));
    fireEvent.click(screen.getByLabelText(/saved the passphrase/i));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    const csr = await screen.findByLabelText("CSR", { selector: "pre" });
    expect(csr.textContent).toMatch(/BEGIN CERTIFICATE REQUEST/);
    expect(downloadText.mock.calls[0][0]).toBe("fleetos-operator-dana@example.org.key.pem");
    expectNoNetwork();
  }, 30_000);

  it("builds the PKCS#12 from the key backup and the signed certificate, still offline", async () => {
    const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-384" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const passphrase = generateBackupPassphrase();
    const backup = await keyBackupPem(keys.privateKey, passphrase);
    const cert = await X509CertificateGenerator.createSelfSigned({
      keys,
      name: "CN=dana@example.org",
      notAfter: new Date(Date.now() + 86_400_000),
      notBefore: new Date(Date.now() - 60_000),
      serialNumber: "0b",
      signingAlgorithm: { hash: "SHA-384", name: "ECDSA" },
    });

    render(<CredentialRequestPage />);
    fireEvent.change(screen.getByLabelText(/^your key backup file/i), {
      target: { files: [new File([backup], "k.key.pem")] },
    });
    fill(/^your signed certificate/i, cert.toString("pem"));
    fill(/^key backup passphrase/i, passphrase);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /build my pkcs#12/i })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /build my pkcs#12/i }));

    await waitFor(() => expect(downloadBytes).toHaveBeenCalled(), { timeout: 15_000 });
    expect(downloadBytes.mock.calls[0][0]).toBe("dana@example.org.p12");
    expectNoNetwork();
  }, 30_000);
});
