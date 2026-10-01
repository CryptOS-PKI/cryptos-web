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

import { Code, ConnectError } from "@connectrpc/connect";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OperatorCARegisterForm } from "@/components/operator-ca-register-form";
import { CrlSource, OcspMode, OcspSigner } from "@/gen/fleet/cryptos/fleet/v1/operator_ca_pb";
import { colonFingerprint } from "@/lib/fingerprint";
import { type RegisterResult, toCARow } from "@/lib/operator-cas";

const SHA = "3c".repeat(32);
const CA_PEM = "-----BEGIN CERTIFICATE-----\nMAA=\n-----END CERTIFICATE-----\n";

const preview = (confirmed = false): RegisterResult => ({
  adminExtfile: "[ op_admin ]",
  confirmed,
  ocspProbe: {
    certStatus: "unknown",
    signer: OcspSigner.DELEGATED,
    signerNotAfter: "2026-10-30T00:00:00Z",
    signerSubject: "CN=Example Operator OCSP",
  },
  operatorCa: toCARow({
    crl: {
      nextUpdate: "2026-10-07T00:00:00Z",
      revokedCount: 3n,
      thisUpdate: "2026-09-30T00:00:00Z",
    },
    crlSource: CrlSource.URL,
    issuer: "CN=Example Operator CA",
    notAfter: "2036-09-30T00:00:00Z",
    ocspMode: OcspMode.URL,
    sha256: SHA,
    subject: "CN=Example Operator CA",
    warnings: ["issued by a CryptOS node's CA"],
  }),
});

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const check = () => screen.getByRole("button", { name: /check the ca/i });

describe("OperatorCARegisterForm", () => {
  it("defaults OCSP to aia and needs a URL for url mode", () => {
    render(<OperatorCARegisterForm onRegistered={vi.fn()} submit={vi.fn()} />);
    fill(/ca certificate/i, CA_PEM);
    fill(/crl url/i, "http://pki.example.org/op.crl");
    expect((screen.getByLabelText(/ocsp mode/i) as HTMLSelectElement).value).toBe("aia");
    expect(check()).toBeEnabled();
    fill(/ocsp mode/i, "url");
    expect(check()).toBeDisabled();
    fill(/responder url/i, "http://ocsp.example.org/");
    expect(check()).toBeEnabled();
  });

  it("needs the NO_CRL acknowledgement and says MCP is refused without a CRL", () => {
    render(<OperatorCARegisterForm onRegistered={vi.fn()} submit={vi.fn()} />);
    fill(/ca certificate/i, CA_PEM);
    fireEvent.click(screen.getByLabelText(/^no crl/i));
    expect(screen.getByText(/MCP is unavailable/i)).toBeInTheDocument();
    expect(check()).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/I understand revocations made at the CA/i));
    expect(check()).toBeEnabled();
  });

  it("previews, then confirms only once the pasted fingerprint matches", async () => {
    const submit = vi.fn().mockResolvedValueOnce(preview()).mockResolvedValueOnce(preview(true));
    const onRegistered = vi.fn();
    render(<OperatorCARegisterForm onRegistered={onRegistered} submit={submit} />);
    fill(/ca certificate/i, CA_PEM);
    fill(/crl url/i, "http://pki.example.org/op.crl");
    fill(/ocsp mode/i, "url");
    fill(/responder url/i, "http://ocsp.example.org/");
    fireEvent.click(check());

    await screen.findByText(colonFingerprint(SHA));
    expect(submit.mock.calls[0][0]).toMatchObject({ confirmSha256: "", ocspMode: "url" });
    expect(screen.getByText(/issued by a CryptOS node's CA/)).toBeInTheDocument();
    expect(screen.getByText(/CN=Example Operator OCSP/)).toBeInTheDocument();
    expect(
      screen.getByText(/openssl x509 -in operator-ca.crt -noout -fingerprint -sha256/),
    ).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: /confirm and trust/i });
    expect(confirm).toBeDisabled();
    fill(/paste the fingerprint/i, "sha256 Fingerprint=" + colonFingerprint("3d".repeat(32)));
    expect(confirm).toBeDisabled();
    fill(/paste the fingerprint/i, "sha256 Fingerprint=" + colonFingerprint(SHA));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(onRegistered).toHaveBeenCalled());
    expect(submit.mock.calls[1][0]).toMatchObject({ confirmSha256: SHA });
  });

  it("explains a refusal by its reason code", async () => {
    const submit = vi.fn().mockRejectedValue(
      new ConnectError("x", Code.InvalidArgument, {
        "x-cryptos-error-code": "1605",
        "x-cryptos-error-reason": "IS_NODE_CA",
      }),
    );
    render(<OperatorCARegisterForm onRegistered={vi.fn()} submit={submit} />);
    fill(/ca certificate/i, CA_PEM);
    fill(/crl url/i, "http://pki.example.org/op.crl");
    fireEvent.click(check());
    expect(await screen.findByRole("alert")).toHaveTextContent(/CryptOS node's CA/);
  });
});
