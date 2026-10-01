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
import { Pkcs10CertificateRequestGenerator } from "@peculiar/x509";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CredentialRequestWizard } from "@/components/credential-request-wizard";
import { base64 } from "@/lib/crypto/leaf-key";
import * as modeMod from "@/lib/fleet/mode";

const downloadText = vi.fn();
vi.mock("@/lib/download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/download")>()),
  downloadText: (...a: unknown[]) => downloadText(...a),
}));

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const holder = (email = "bob@example.org", level = "operator") => {
  fill(/full name/i, "Bob Example");
  fill(/^email/i, email);
  fill(/access level/i, level);
};

// backUp walks the key backup step: download, tick, continue.
const backUp = async () => {
  await screen.findByLabelText(/key backup passphrase/i, {}, { timeout: 10_000 });
  fireEvent.click(screen.getByRole("button", { name: /download key backup/i }));
  fireEvent.click(screen.getByLabelText(/saved the passphrase/i));
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
};

const csrPem = async (cn: string): Promise<string> => {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-384" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const csr = await Pkcs10CertificateRequestGenerator.create({
    keys,
    name: `CN=${cn}`,
    signingAlgorithm: { hash: "SHA-384", name: "ECDSA" },
  });
  return csr.toString("pem");
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
beforeEach(() => downloadText.mockReset());

describe("CredentialRequestWizard (mock mode)", () => {
  it("makes the key here, forces the backup, then shows the CSR and the signing recipe", async () => {
    const onCreated = vi.fn();
    render(<CredentialRequestWizard onClose={vi.fn()} onCreated={onCreated} />);
    holder();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.queryByLabelText("CSR")).not.toBeInTheDocument();
    await backUp();

    await screen.findByLabelText("CSR", {}, { timeout: 10_000 });
    expect(screen.getByLabelText("CSR").textContent).toMatch(/BEGIN CERTIFICATE REQUEST/);
    expect(screen.getByLabelText(/extension section/i, { selector: "pre" }).textContent).toContain(
      "op_operator",
    );
    expect(screen.getByLabelText(/signing command/i, { selector: "pre" }).textContent).toContain(
      "openssl ca",
    );
    fireEvent.click(screen.getByRole("button", { name: "Download CSR" }));
    expect(downloadText).toHaveBeenLastCalledWith(
      "fleetos-operator-bob@example.org.csr",
      expect.stringMatching(/BEGIN CERTIFICATE REQUEST/),
    );
    const [requestId, backup] = onCreated.mock.calls[0] as [string, Uint8Array];
    expect(requestId).not.toBe("");
    expect(new TextDecoder().decode(backup)).toMatch(/ENCRYPTED PRIVATE KEY/);
  }, 30_000);

  it("takes an uploaded CSR whose CN is the holder's email", async () => {
    const onCreated = vi.fn();
    render(<CredentialRequestWizard onClose={vi.fn()} onCreated={onCreated} />);
    holder("carol@example.org", "viewer");
    fireEvent.click(screen.getByLabelText(/upload a csr/i));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    fill(/paste the csr/i, await csrPem("carol@example.org"));
    fireEvent.click(screen.getByRole("button", { name: /file the request/i }));

    await screen.findByLabelText("CSR");
    expect(onCreated).toHaveBeenCalledWith(expect.any(String), undefined);
  }, 30_000);

  it("refuses an uploaded CSR for someone else", async () => {
    render(<CredentialRequestWizard onClose={vi.fn()} onCreated={vi.fn()} />);
    holder("carol@example.org");
    fireEvent.click(screen.getByLabelText(/upload a csr/i));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    fill(/paste the csr/i, await csrPem("mallory@example.org"));
    fireEvent.click(screen.getByRole("button", { name: /file the request/i }));

    await screen.findByText(/mallory@example.org/);
    expect(screen.queryByLabelText("CSR")).not.toBeInTheDocument();
  }, 30_000);

  it("needs a name, a valid email and a level before Next", () => {
    render(<CredentialRequestWizard onClose={vi.fn()} onCreated={vi.fn()} />);
    const next = screen.getByRole("button", { name: /next/i });
    expect(next).toBeDisabled();
    fill(/full name/i, "Bob");
    fill(/^email/i, "not-an-email");
    expect(next).toBeDisabled();
    fill(/^email/i, "bob@example.org");
    expect(next).toBeEnabled();
  });
});

describe("CredentialRequestWizard (live mode)", () => {
  it("never puts the private key or the passphrase in a request body", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const generated: CryptoKeyPair[] = [];
    const realGenerate = crypto.subtle.generateKey.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, "generateKey").mockImplementation((async (
      ...args: Parameters<SubtleCrypto["generateKey"]>
    ) => {
      const keys = await realGenerate(...args);
      if ("privateKey" in (keys as CryptoKeyPair)) generated.push(keys as CryptoKeyPair);
      return keys;
    }) as SubtleCrypto["generateKey"]);

    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const raw = init?.body;
        bodies.push(ArrayBuffer.isView(raw) ? new TextDecoder().decode(raw) : String(raw ?? ""));
        return Response.json(
          {
            csrPem:
              "-----BEGIN CERTIFICATE REQUEST-----\nMAA=\n-----END CERTIFICATE REQUEST-----\n",
            expiresAt: "2026-10-30T00:00:00Z",
            extfileSection: "[ op_admin ]",
            opensslCommand: "openssl ca -extensions op_admin",
            requestId: "req-1",
          },
          { headers: { "content-type": "application/json" }, status: 200 },
        );
      }),
    );

    render(<CredentialRequestWizard onClose={vi.fn()} onCreated={vi.fn()} />);
    holder("alice@example.org", "admin");
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    const shown = await screen.findByLabelText(/key backup passphrase/i, {}, { timeout: 10_000 });
    const passphrase = shown.textContent ?? "";
    await backUp();
    await screen.findByLabelText("CSR", {}, { timeout: 10_000 });

    expect(bodies).toHaveLength(1);
    const body = bodies[0];
    expect(JSON.parse(body)).toHaveProperty("csrDer");
    expect(generated).toHaveLength(1);
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", generated[0].privateKey));
    const jwk = await crypto.subtle.exportKey("jwk", generated[0].privateKey);
    const b64 = base64(pkcs8);
    const b64url = b64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    for (const secret of [b64, b64url, b64.slice(40, 100), jwk.d ?? "unset", passphrase]) {
      expect(body).not.toContain(secret);
    }
  }, 30_000);
});
