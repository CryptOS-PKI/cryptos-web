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

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { NodeConfigPage } from "@/pages/node-config";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<NodeConfigPage />} path="/nodes/:name/config" />
        <Route element={<div>node hub</div>} path="/nodes/:name" />
      </Routes>
    </MemoryRouter>,
  );

describe("NodeConfigPage", () => {
  it("applies config and shows a result", () => {
    renderAt("/nodes/acme-issuing-01/config");
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(screen.getByText(/applied/i)).toBeInTheDocument();
  });

  it("redirects a revoked node to the hub", () => {
    renderAt("/nodes/acme-intermediate-02/config");
    expect(screen.getByText("node hub")).toBeInTheDocument();
  });
});
