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
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetAdapters, getAdapter } from "@/lib/adapters";
import { __resetProfiles } from "@/lib/profiles";
import { ProtocolDetailPage } from "@/pages/protocol-detail";

// mock mode keeps the in-memory catalog; the auth gate is mocked to an admin so
// the toggle control renders without an AuthProvider.
vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    operator: { commonName: "admin@acme.example", level: "admin", serial: "AA" },
    status: "authenticated",
  }),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtocolDetailPage />} path="/protocols/:kind" />
        <Route element={<div>protocols list</div>} path="/protocols" />
      </Routes>
    </MemoryRouter>,
  );

describe("ProtocolDetailPage", () => {
  beforeEach(() => {
    __resetAdapters();
    __resetProfiles();
  });

  it("edits an adapter's bound profile", () => {
    renderAt("/protocols/acme");
    fireEvent.change(screen.getByLabelText(/bound profile/i), {
      target: { value: "Domain Controller" },
    });
    expect(getAdapter("acme")?.profile).toBe("Domain Controller");
  });

  it("toggles the adapter and shows the honest engine-pending note", async () => {
    renderAt("/protocols/scep");
    expect(screen.getByRole("note")).toHaveTextContent(/does not yet serve enrollment requests/i);
    expect(getAdapter("scep")?.enabled).toBe(false);
    fireEvent.click(screen.getByLabelText(/enabled/i));
    await waitFor(() => expect(getAdapter("scep")?.enabled).toBe(true));
  });

  it("redirects an unknown protocol to the list", () => {
    renderAt("/protocols/nope");
    expect(screen.getByText("protocols list")).toBeInTheDocument();
  });
});
