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
import {
  BasicConstraintsExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  X509CertificateGenerator,
} from "@peculiar/x509";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FirstRunWizard } from "@/components/first-run/first-run-wizard";
import { __resetBootstrap } from "@/lib/bootstrap";
import { base64 } from "@/lib/crypto/leaf-key";
import { colonFingerprint } from "@/lib/fingerprint";
import * as modeMod from "@/lib/fleet/mode";

const { buildCredentialPkcs12, downloadBytes, downloadText } = vi.hoisted(() => ({
  buildCredentialPkcs12: vi.fn(),
  downloadBytes: vi.fn(),
  downloadText: vi.fn(),
}));
vi.mock("@/lib/download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/download")>()),
  downloadBytes: (...a: unknown[]) => downloadBytes(...a),
  downloadText: (...a: unknown[]) => downloadText(...a),
}));
vi.mock("@/lib/crypto/key-backup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crypto/key-backup")>();
  buildCredentialPkcs12.mockImplementation(actual.buildCredentialPkcs12);
  return { ...actual, buildCredentialPkcs12: (...a: unknown[]) => buildCredentialPkcs12(...a) };
});

const P384 = { name: "ECDSA", namedCurve: "P-384" } as const;
const EMAIL = "ada@example.org";

const sha256Hex = async (der: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(der))), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

const makeCA = async () => {
  const keys = (await crypto.subtle.generateKey(P384, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    extensions: [
      new BasicConstraintsExtension(true, 0, true),
      new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
    ],
    keys,
    name: "CN=Example Operator CA",
    notAfter: new Date(Date.now() + 3650 * 86_400_000),
    notBefore: new Date(Date.now() - 60_000),
    serialNumber: "01",
    signingAlgorithm: { hash: "SHA-384", name: "ECDSA" },
  });
  return { der: new Uint8Array(cert.rawData), keys, pem: cert.toString("pem") };
};

// The leaf the CA "signs" for the browser's key: the test captures the key
// pair the wizard generates and issues a certificate for its public half.
const signLeaf = async (ca: Awaited<ReturnType<typeof makeCA>>, publicKey: CryptoKey) => {
  const leaf = await X509CertificateGenerator.create({
    issuer: "CN=Example Operator CA",
    notAfter: new Date(Date.now() + 365 * 86_400_000),
    notBefore: new Date(Date.now() - 60_000),
    publicKey,
    serialNumber: "0a",
    signingAlgorithm: { hash: "SHA-384", name: "ECDSA" },
    signingKey: ca.keys.privateKey,
    subject: `CN=${EMAIL}`,
  });
  return leaf.toString("pem");
};

const fill = (label: RegExp, value: string, root: HTMLElement = document.body) =>
  fireEvent.change(within(root).getByLabelText(label), { target: { value } });

const captureKeys = () => {
  const generated: CryptoKeyPair[] = [];
  const real = crypto.subtle.generateKey.bind(crypto.subtle);
  vi.spyOn(crypto.subtle, "generateKey").mockImplementation((async (
    ...args: Parameters<SubtleCrypto["generateKey"]>
  ) => {
    const keys = await real(...args);
    if ("privateKey" in (keys as CryptoKeyPair)) generated.push(keys as CryptoKeyPair);
    return keys;
  }) as SubtleCrypto["generateKey"]);
  return generated;
};

const startSession = async () => {
  fill(/bootstrap token/i, "fos_boot_7K3Q-M2XD-9FJA");
  fireEvent.click(screen.getByRole("button", { name: /start first run/i }));
  await screen.findByRole("button", { name: /check the ca/i });
};

const registerCA = async (ca: Awaited<ReturnType<typeof makeCA>>) => {
  fill(/operator ca certificate/i, ca.pem);
  fill(/crl url/i, "http://pki.example.org/fleetos-operator.crl");
  fireEvent.click(screen.getByRole("button", { name: /check the ca/i }));
  await screen.findByLabelText(/paste the fingerprint/i);
  fill(/paste the fingerprint/i, colonFingerprint(await sha256Hex(ca.der)));
  fireEvent.click(screen.getByRole("button", { name: /confirm and trust/i }));
  await screen.findByRole("heading", { name: /first admin certificate/i });
};

const pathA = async (ca: Awaited<ReturnType<typeof makeCA>>, generated: CryptoKeyPair[]) => {
  fill(/full name/i, "Ada Admin");
  fill(/^email/i, EMAIL);
  fireEvent.click(screen.getByRole("button", { name: /make my admin key/i }));
  const shown = await screen.findByLabelText(
    /key backup passphrase/i,
    { selector: "code" },
    { timeout: 10_000 },
  );
  const passphrase = shown.textContent ?? "";
  expect(screen.queryByLabelText("CSR", { selector: "pre" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /download key backup/i }));
  fireEvent.click(screen.getByLabelText(/saved the passphrase/i));
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  await screen.findByLabelText("CSR", { selector: "pre" });

  const certPem = await signLeaf(ca, generated.at(-1)?.publicKey as CryptoKey);
  fill(/signed admin certificate/i, certPem);
  fill(/^key backup passphrase/i, passphrase);
  fireEvent.click(screen.getByRole("button", { name: /record and build/i }));
  await screen.findByRole(
    "heading",
    { name: /install your admin certificate/i },
    { timeout: 15_000 },
  );
  return passphrase;
};

beforeEach(() => {
  __resetBootstrap();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("FirstRunWizard token step", () => {
  it("leads with the fingerprint check and shows where the token is on each OS", () => {
    render(<FirstRunWizard inProgress={false} tokenExpiresAt="2026-09-30T13:00:00Z" />);
    const danger = screen.getAllByRole("note")[0];
    expect(danger).toHaveTextContent(/fingerprint/i);
    expect(danger).toHaveTextContent(/server certificate SHA-256/);
    expect(
      screen.getByText(/docker logs <container> 2>&1 \| grep 'bootstrap token'/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/journalctl -u fleet-manager \| grep 'bootstrap token'/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Select-String 'bootstrap token'/)).toBeInTheDocument();
    expect(screen.getByText(/can't be the operator CA/i)).toBeInTheDocument();
    expect(screen.queryByText(/already started/i)).not.toBeInTheDocument();
  });

  it("warns when first run was already started", () => {
    render(<FirstRunWizard inProgress tokenExpiresAt="" />);
    expect(screen.getByText(/already started/i)).toBeInTheDocument();
  });

  it("explains a refused token by its code", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    render(<FirstRunWizard inProgress={false} tokenExpiresAt="" />);
    fill(/bootstrap token/i, "not-a-token");
    fireEvent.click(screen.getByRole("button", { name: /start first run/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /newest one from the Fleet Manager's log/,
    );
  });
});

describe("FirstRunWizard (mock mode)", () => {
  beforeEach(() => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
  });

  it("path A: token, CA with fingerprint confirm, key backup before the CSR, upload, PKCS#12, install", async () => {
    const generated = captureKeys();
    const ca = await makeCA();
    render(<FirstRunWizard inProgress={false} tokenExpiresAt="" />);
    await startSession();
    await registerCA(ca);
    const passphrase = await pathA(ca, generated);

    const [args] = buildCredentialPkcs12.mock.calls[0] as [
      { chainDer: Uint8Array[]; friendlyName: string; passphrase: string },
    ];
    expect(args.passphrase).toBe(passphrase);
    expect(args.chainDer).toEqual([ca.der]);
    expect(args.friendlyName).toBe(`FleetOS admin (${EMAIL})`);
    expect(downloadBytes.mock.calls[0][0]).toBe(`${EMAIL}.p12`);
    expect(screen.getByText(/Current User/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
  }, 60_000);

  it("path B: the recipe, an optional pre-flight, then install", async () => {
    const ca = await makeCA();
    render(<FirstRunWizard inProgress={false} tokenExpiresAt="" />);
    await startSession();
    await registerCA(ca);
    fireEvent.click(screen.getByLabelText(/path b/i));
    fill(/^email/i, EMAIL);
    expect(screen.getByText(/openssl pkcs12 -export/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/admin extension section/i, { selector: "pre" }).textContent,
    ).toContain("op_admin");
    fireEvent.click(screen.getByRole("button", { name: /skip to install/i }));
    await screen.findByRole("heading", { name: /install your admin certificate/i });
  }, 60_000);
});

describe("FirstRunWizard (live mode)", () => {
  it("never sends the key or the passphrase, and keeps nothing in storage", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
    const generated = captureKeys();
    const ca = await makeCA();
    const caSha = await sha256Hex(ca.der);
    const bodies: string[] = [];
    let registerCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const raw = init?.body;
        bodies.push(ArrayBuffer.isView(raw) ? new TextDecoder().decode(raw) : String(raw ?? ""));
        const method = String(input).split("/").pop();
        const confirmed = method === "RegisterOperatorCA" && registerCalls++ > 0;
        const body: Record<string, unknown> = {
          RegisterOperatorCA: {
            adminExtfile: "[ op_admin ]",
            confirmed,
            operatorCa: { sha256: caSha, subject: "CN=Example Operator CA" },
          },
          StartBootstrapSession: {
            expiresAt: "2026-09-30T13:00:00Z",
            sessionSecret: "fos_bsess_live",
          },
          SubmitFirstAdminCertificate: { email: EMAIL, serialHex: "0A" },
        };
        return Response.json(body[method ?? ""] ?? {}, {
          headers: { "content-type": "application/json" },
          status: 200,
        });
      }),
    );

    render(<FirstRunWizard inProgress={false} tokenExpiresAt="" />);
    await startSession();
    await registerCA(ca);
    const passphrase = await pathA(ca, generated);

    const key = generated.at(-1)?.privateKey as CryptoKey;
    const pkcs8 = base64(new Uint8Array(await crypto.subtle.exportKey("pkcs8", key)));
    const jwk = await crypto.subtle.exportKey("jwk", key);
    expect(bodies.length).toBeGreaterThanOrEqual(4);
    for (const body of bodies) {
      for (const secret of [pkcs8, jwk.d ?? "unset", passphrase])
        expect(body).not.toContain(secret);
    }
    const stored = [
      ...Object.values(localStorage),
      ...Object.values(sessionStorage),
      document.cookie,
    ].join("\n");
    expect(stored).not.toContain("fos_bsess_live");
    expect(stored).not.toContain(passphrase);
  }, 60_000);
});
