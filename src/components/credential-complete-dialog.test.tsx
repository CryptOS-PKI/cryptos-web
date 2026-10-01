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
import { Code, ConnectError } from "@connectrpc/connect";
import { X509CertificateGenerator } from "@peculiar/x509";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CredentialRequestRow } from "@/lib/operators";

import { CredentialCompleteDialog } from "@/components/credential-complete-dialog";
import { generateBackupPassphrase, keyBackupPem } from "@/lib/crypto/key-backup";
import { base64 } from "@/lib/crypto/leaf-key";
import * as modeMod from "@/lib/fleet/mode";
import * as operators from "@/lib/operators";

const { buildCredentialPkcs12, downloadBytes } = vi.hoisted(() => ({
  buildCredentialPkcs12: vi.fn(),
  downloadBytes: vi.fn(),
}));
vi.mock("@/lib/download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/download")>()),
  downloadBytes: (...a: unknown[]) => downloadBytes(...a),
}));

vi.mock("@/lib/crypto/key-backup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crypto/key-backup")>();
  buildCredentialPkcs12.mockImplementation(actual.buildCredentialPkcs12);
  return { ...actual, buildCredentialPkcs12: (...a: unknown[]) => buildCredentialPkcs12(...a) };
});

const EMAIL = "new-hire@example.org";

const request: CredentialRequestRow = {
  completedSerial: "",
  createdAt: "2026-09-29T14:00:00Z",
  createdByCn: "admin@example.org",
  csrPem: "",
  email: EMAIL,
  expiresAt: "2026-10-29T14:00:00Z",
  fullName: "New Hire",
  id: "req-1",
  level: "operator",
  state: "pending",
};

const material = async () => {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-384" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const passphrase = generateBackupPassphrase();
  const backup = new TextEncoder().encode(await keyBackupPem(keys.privateKey, passphrase));
  const cert = await X509CertificateGenerator.createSelfSigned({
    keys,
    name: `CN=${EMAIL}`,
    notAfter: new Date(Date.now() + 86_400_000),
    notBefore: new Date(Date.now() - 60_000),
    serialNumber: "0a",
    signingAlgorithm: { hash: "SHA-384", name: "ECDSA" },
  });
  return { backup, certPem: cert.toString("pem"), keys, passphrase };
};

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  downloadBytes.mockReset();
  buildCredentialPkcs12.mockClear();
  operators.__resetOperators();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CredentialCompleteDialog", () => {
  it("records the certificate, then builds the PKCS#12 with the key backup's passphrase", async () => {
    const { backup, certPem, passphrase } = await material();
    const record = vi.spyOn(operators, "recordOperatorCredential");
    const onRecorded = vi.fn();
    render(
      <CredentialCompleteDialog
        heldBackup={backup}
        onClose={vi.fn()}
        onRecorded={onRecorded}
        request={request}
      />,
    );

    fill(/signed certificate/i, certPem);
    fill(/backup passphrase/i, passphrase);
    fireEvent.click(screen.getByRole("button", { name: /record/i }));

    await waitFor(() => expect(downloadBytes).toHaveBeenCalled(), { timeout: 15_000 });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ requestId: "req-1" }));
    const [args] = buildCredentialPkcs12.mock.calls[0] as [
      { backup: Uint8Array; friendlyName: string; passphrase: string },
    ];
    expect(args.backup).toBe(backup);
    expect(args.passphrase).toBe(passphrase);
    expect(args.friendlyName).toBe(`FleetOS operator (${EMAIL})`);
    expect(downloadBytes.mock.calls[0][0]).toBe(`${EMAIL}.p12`);
    expect(onRecorded).toHaveBeenCalled();
    expect(screen.getByText(/PKCS#12 downloaded/i)).toBeInTheDocument();
  }, 30_000);

  it("stops before recording when the passphrase doesn't open the backup", async () => {
    const { backup, certPem } = await material();
    const record = vi.spyOn(operators, "recordOperatorCredential");
    render(
      <CredentialCompleteDialog
        heldBackup={backup}
        onClose={vi.fn()}
        onRecorded={vi.fn()}
        request={request}
      />,
    );
    fill(/signed certificate/i, certPem);
    fill(/backup passphrase/i, "wrong-passphrase-wrong-pass");
    fireEvent.click(screen.getByRole("button", { name: /record/i }));

    await screen.findByText(/passphrase is wrong/i, {}, { timeout: 15_000 });
    expect(record).not.toHaveBeenCalled();
    expect(downloadBytes).not.toHaveBeenCalled();
  }, 30_000);

  it("takes a key backup file when the browser holds none", async () => {
    const { backup, certPem, passphrase } = await material();
    render(<CredentialCompleteDialog onClose={vi.fn()} onRecorded={vi.fn()} request={request} />);
    expect(screen.queryByLabelText(/held in this browser/i)).not.toBeInTheDocument();
    fill(/signed certificate/i, certPem);
    fireEvent.change(screen.getByLabelText(/^key backup file/i), {
      target: { files: [new File([new TextDecoder().decode(backup)], "k.key.pem")] },
    });
    fill(/backup passphrase/i, passphrase);
    await waitFor(() => expect(screen.getByRole("button", { name: /record/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /record/i }));
    await waitFor(() => expect(downloadBytes).toHaveBeenCalled(), { timeout: 15_000 });
  }, 30_000);

  it("only records when the holder keeps the key", async () => {
    const { certPem } = await material();
    const record = vi.spyOn(operators, "recordOperatorCredential");
    render(<CredentialCompleteDialog onClose={vi.fn()} onRecorded={vi.fn()} request={request} />);
    fill(/signed certificate/i, certPem);
    fireEvent.click(screen.getByLabelText(/holder has the key/i));
    fireEvent.click(screen.getByRole("button", { name: /record/i }));
    await screen.findByText(/recorded/i, { selector: "[role=status]" });
    expect(record).toHaveBeenCalled();
    expect(downloadBytes).not.toHaveBeenCalled();
    expect(screen.getByText(/openssl pkcs12 -export/)).toBeInTheDocument();
  }, 30_000);

  it("explains a refusal by its reason code", async () => {
    const { certPem } = await material();
    vi.spyOn(operators, "recordOperatorCredential").mockRejectedValue(
      new ConnectError("refused", Code.InvalidArgument, {
        "x-cryptos-error-code": "1610",
        "x-cryptos-error-reason": "LEVEL_EXT_CRITICAL",
      }),
    );
    render(<CredentialCompleteDialog onClose={vi.fn()} onRecorded={vi.fn()} request={request} />);
    fill(/signed certificate/i, certPem);
    fireEvent.click(screen.getByLabelText(/holder has the key/i));
    fireEvent.click(screen.getByRole("button", { name: /record/i }));
    await screen.findByText(/marked critical/i);
  }, 30_000);

  it("asks for the holder's name when recording without a request", async () => {
    const { certPem } = await material();
    const record = vi.spyOn(operators, "recordOperatorCredential");
    render(<CredentialCompleteDialog onClose={vi.fn()} onRecorded={vi.fn()} request={null} />);
    fill(/signed certificate/i, certPem);
    fill(/holder's full name/i, "Out Of Band");
    fireEvent.click(screen.getByLabelText(/holder has the key/i));
    fireEvent.click(screen.getByRole("button", { name: /record/i }));
    await waitFor(() =>
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: "Out Of Band", requestId: undefined }),
      ),
    );
  }, 30_000);

  it("never puts the key or the passphrase in a request body (live)", async () => {
    const { backup, certPem, keys, passphrase } = await material();
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const raw = init?.body;
        bodies.push(ArrayBuffer.isView(raw) ? new TextDecoder().decode(raw) : String(raw ?? ""));
        return Response.json(
          {
            credential: { commonName: EMAIL, email: EMAIL, level: "operator", serialHex: "0A" },
          },
          { headers: { "content-type": "application/json" }, status: 200 },
        );
      }),
    );
    render(
      <CredentialCompleteDialog
        heldBackup={backup}
        onClose={vi.fn()}
        onRecorded={vi.fn()}
        request={request}
      />,
    );
    fill(/signed certificate/i, certPem);
    fill(/backup passphrase/i, passphrase);
    fireEvent.click(screen.getByRole("button", { name: /record/i }));
    await waitFor(() => expect(downloadBytes).toHaveBeenCalled(), { timeout: 15_000 });

    expect(bodies).toHaveLength(1);
    const pkcs8 = base64(new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey)));
    const jwk = await crypto.subtle.exportKey("jwk", keys.privateKey);
    const backupB64 = base64(backup);
    for (const secret of [pkcs8, jwk.d ?? "unset", passphrase, backupB64]) {
      expect(bodies[0]).not.toContain(secret);
    }
  }, 30_000);
});
