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

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { NodeRekeyPage } from "@/pages/node-rekey";
import { expectNoA11yViolations } from "@/test/axe";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<NodeRekeyPage />} path="/nodes/:name/rekey" />
        <Route element={<div>node hub</div>} path="/nodes/:name" />
      </Routes>
    </MemoryRouter>,
  );

describe("NodeRekeyPage", () => {
  it("has no axe violations", async () => {
    const { container } = renderAt("/nodes/acme-issuing-01/rekey");
    await expectNoA11yViolations(container);
  });

  it("shows the re-key wizard for an operational node", () => {
    renderAt("/nodes/acme-issuing-01/rekey");
    expect(screen.getByText(/re-key \/ ceremony/i)).toBeInTheDocument();
  });

  it("redirects a revoked node to the hub", () => {
    renderAt("/nodes/acme-intermediate-02/rekey");
    expect(screen.getByText("node hub")).toBeInTheDocument();
  });
});
