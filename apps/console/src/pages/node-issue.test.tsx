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
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetCerts, certsFor } from "@/lib/certs";
import { NodeIssuePage } from "@/pages/node-issue";
import { expectNoA11yViolations } from "@/test/axe";

// IssueForm needs operator level or above; this page's own gating is covered
// in issue-form.test.tsx, so every test here runs as an operator.
vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    operator: { commonName: "op@acme.example", level: "operator", serial: "AA" },
    status: "authenticated",
  }),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<NodeIssuePage />} path="/nodes/:name/issue" />
        <Route element={<div>node hub</div>} path="/nodes/:name" />
      </Routes>
    </MemoryRouter>,
  );

describe("NodeIssuePage", () => {
  beforeEach(() => __resetCerts());

  it("has no axe violations", async () => {
    const { container } = renderAt("/nodes/acme-issuing-01/issue");
    await expectNoA11yViolations(container);
  });

  it("issues a leaf cert from an issuing CA", async () => {
    const before = certsFor("acme-issuing-01").length;
    renderAt("/nodes/acme-issuing-01/issue");
    fireEvent.change(screen.getByLabelText(/subject cn/i), {
      target: { value: "new.acme.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^issue$/i }));
    await waitFor(() => expect(certsFor("acme-issuing-01").length).toBe(before + 1));
    expect(screen.getByText(/issued/i)).toBeInTheDocument();
  });

  it("redirects a CA that cannot issue back to the hub", () => {
    renderAt("/nodes/acme-intermediate-02/issue"); // REVOKED -> canIssue []
    expect(screen.getByText("node hub")).toBeInTheDocument();
  });
});
