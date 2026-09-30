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

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { RootDetailPage } from "@/pages/root-detail";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RootDetailPage />} path="/root/:name" />
        <Route element={<div>roots list</div>} path="/root" />
      </Routes>
    </MemoryRouter>,
  );

describe("RootDetailPage", () => {
  it("shows a root's connection, config, and ceremony", () => {
    renderAt("/root/acme-root-01");
    expect(screen.getByText("acme-root-01")).toBeInTheDocument();
    expect(screen.getByText(/connection/i)).toBeInTheDocument();
    expect(screen.getByText("fm-client@acme-root-01")).toBeInTheDocument();
    expect(screen.getByText(/config/i)).toBeInTheDocument();
    expect(screen.getByText(/ceremony/i)).toBeInTheDocument();
  });

  it("redirects a non-root node to the roots list", () => {
    renderAt("/root/acme-issuing-01"); // an issuing node, not a root
    expect(screen.getByText("roots list")).toBeInTheDocument();
  });
});
