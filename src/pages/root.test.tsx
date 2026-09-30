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

import { RootPage } from "@/pages/root";

describe("RootPage", () => {
  it("lists the root CAs, each linking to its detail page", () => {
    render(
      <MemoryRouter>
        <RootPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /acme-root-01/ })).toHaveAttribute(
      "href",
      "/root/acme-root-01",
    );
    expect(screen.getByRole("link", { name: /acme-root-02/ })).toHaveAttribute(
      "href",
      "/root/acme-root-02",
    );
  });

  it("search filters to matching root CAs only", () => {
    render(
      <MemoryRouter>
        <RootPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Filter name"), {
      target: { value: "acme-root-01" },
    });
    expect(screen.getByRole("link", { name: /acme-root-01/ })).toBeInTheDocument();
    expect(screen.queryByText("acme-root-02")).not.toBeInTheDocument();
  });
});
