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

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { __resetCerts } from "@/lib/certs";
import { __resetNodes, nodesList } from "@/lib/nodes";
import { NodeDetailPage } from "@/pages/node-detail";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<NodeDetailPage />} path="/nodes/:name" />
      </Routes>
    </MemoryRouter>,
  );

describe("NodeDetailPage trust chain", () => {
  beforeEach(() => {
    __resetNodes();
    __resetCerts();
  });

  it("shows the trust chain with a link to an ancestor", () => {
    renderAt("/nodes/acme-issuing-01");
    const chain = screen.getByText(/trust chain/i).closest("div")?.parentElement as HTMLElement;
    expect(within(chain).getByRole("link", { name: "acme-root-01" })).toHaveAttribute(
      "href",
      "/nodes/acme-root-01",
    );
    expect(within(chain).getByRole("link", { name: "acme-intermediate-01" })).toBeInTheDocument();
  });
});

// A root has no page under /nodes -- that route used to render an empty one
// (#86). It now sends the operator to the page that actually has the root.
describe("NodeDetailPage root deep link", () => {
  beforeEach(() => {
    __resetNodes();
    __resetCerts();
  });

  it("redirects a root to its own page", () => {
    const root = nodesList().find((n) => n.role === "root");
    if (!root) throw new Error("fixture has no root node");

    render(
      <MemoryRouter initialEntries={[`/nodes/${root.name}`]}>
        <Routes>
          <Route element={<NodeDetailPage />} path="/nodes/:name" />
          <Route element={<div>root surface for {root.name}</div>} path="/root/:name" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(`root surface for ${root.name}`)).toBeInTheDocument();
  });
});
