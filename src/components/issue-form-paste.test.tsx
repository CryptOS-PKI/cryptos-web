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

import "reflect-metadata";
import { Pkcs10CertificateRequestGenerator } from "@peculiar/x509";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vitest";

import { IssueForm } from "@/components/issue-form";
import { nodesList } from "@/lib/nodes";

let csrPem = "";

beforeAll(async () => {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-384" }, true, [
    "sign",
    "verify",
  ]);
  const csr = await Pkcs10CertificateRequestGenerator.create({
    keys,
    name: "CN=appliance.acme.example",
    signingAlgorithm: { hash: "SHA-384", name: "ECDSA" },
  });
  csrPem = csr.toString("pem");
});

const renderForm = () => {
  const node = nodesList().find((n) => n.role !== "root");
  if (!node) throw new Error("fixture has no issuing node");

  return render(
    <MemoryRouter>
      <IssueForm node={node} onIssued={() => {}} />
    </MemoryRouter>,
  );
};

describe("IssueForm pasted CSR", () => {
  // An appliance generates its own key and exposes no choice, so its operator
  // arrives holding a CSR rather than wanting one made for them (#88).
  it("previews the subject and key of a pasted request", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /paste a csr/i }));
    fireEvent.change(screen.getByPlaceholderText(/BEGIN CERTIFICATE REQUEST/i), {
      target: { value: csrPem },
    });

    await waitFor(() => {
      expect(screen.getByText("appliance.acme.example")).toBeInTheDocument();
    });
    expect(screen.getByText(/ECDSA P-384/)).toBeInTheDocument();
  });

  // Offering a subject field that the signer would ignore invites the operator
  // to believe they changed something.
  it("stops asking for a subject once a request supplies one", () => {
    renderForm();

    expect(screen.getByText(/subject cn/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /paste a csr/i }));

    expect(screen.queryByText(/subject cn/i)).not.toBeInTheDocument();
  });

  it("explains a paste it cannot read", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /paste a csr/i }));
    fireEvent.change(screen.getByPlaceholderText(/BEGIN CERTIFICATE REQUEST/i), {
      target: { value: "not a csr" },
    });

    await waitFor(() => {
      expect(screen.getByText(/not a PKCS#10 request/i)).toBeInTheDocument();
    });
  });
});
