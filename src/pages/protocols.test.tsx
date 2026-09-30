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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetAdapters, getAdapter } from "@/lib/adapters";
import { ProtocolsPage } from "@/pages/protocols";

// mock mode keeps the in-memory catalog; the auth gate is mocked to an admin so
// the toggle controls render without an AuthProvider.
vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    operator: { commonName: "admin@acme.example", level: "admin", serial: "AA" },
    status: "authenticated",
  }),
}));

describe("ProtocolsPage", () => {
  beforeEach(() => __resetAdapters());

  it("lists adapters linking to their detail", () => {
    render(
      <MemoryRouter>
        <ProtocolsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /ACME/ })).toHaveAttribute("href", "/protocols/acme");
  });

  // The note used to say ACME and EST ship "in a later release", which stopped
  // being true once the nodes shipped RFC 8555 and RFC 7030 -- it told operators
  // the protocols they had configured did not exist (#84).
  it("credits the protocols the nodes actually serve", () => {
    render(
      <MemoryRouter>
        <ProtocolsPage />
      </MemoryRouter>,
    );

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(/served by the\s+nodes themselves/i);
    expect(note).not.toHaveTextContent(
      /ACME, EST, SCEP, and Windows autoenrollment services ship/i,
    );
  });

  // SCEP and Windows autoenrollment genuinely are not implemented, and saying
  // so is the half of the old note that was correct.
  it("still says SCEP and Windows autoenrollment are not implemented", () => {
    render(
      <MemoryRouter>
        <ProtocolsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("note")).toHaveTextContent(
      /SCEP and Windows autoenrollment are not implemented/i,
    );
  });

  it("toggles an adapter from the row", async () => {
    render(
      <MemoryRouter>
        <ProtocolsPage />
      </MemoryRouter>,
    );
    expect(getAdapter("scep")?.enabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /enable scep/i }));
    await waitFor(() => expect(getAdapter("scep")?.enabled).toBe(true));
  });
});
