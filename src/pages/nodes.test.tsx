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
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { NodesPage } from "@/pages/nodes";

describe("NodesPage", () => {
  it("lists operational nodes and excludes the root", () => {
    render(
      <MemoryRouter>
        <NodesPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /acme-issuing-01/ })).toHaveAttribute(
      "href",
      "/nodes/acme-issuing-01",
    );
    expect(screen.queryByText("acme-root-01")).not.toBeInTheDocument();
  });

  it("search filters to matching nodes only", () => {
    render(
      <MemoryRouter>
        <NodesPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Filter name"), {
      target: { value: "acme-issuing-01" },
    });
    expect(screen.getByRole("link", { name: /acme-issuing-01/ })).toBeInTheDocument();
    expect(screen.queryByText("acme-intermediate-01")).not.toBeInTheDocument();
  });
});

// Silently omitting roots made a two-node fleet look like a one-node fleet
// (#86). The page now says where they went.
describe("NodesPage hidden roots", () => {
  it("says roots are listed under Root and links there", () => {
    render(
      <MemoryRouter>
        <NodesPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/listed under/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Root$/ })).toHaveAttribute("href", "/root");
  });
});
