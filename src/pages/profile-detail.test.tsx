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

import { __resetProfiles, getProfile } from "@/lib/profiles";
import { ProfileDetailPage } from "@/pages/profile-detail";

// mock mode keeps the in-memory catalog; the auth gate is mocked to an admin so
// the edit/delete controls render without an AuthProvider.
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
        <Route element={<ProfileDetailPage />} path="/profiles/:name" />
        <Route element={<div>profiles list</div>} path="/profiles" />
      </Routes>
    </MemoryRouter>,
  );

describe("ProfileDetailPage", () => {
  beforeEach(() => __resetProfiles());

  it("edits an existing profile's validity", async () => {
    renderAt("/profiles/Code Signing");
    const validity = screen.getByLabelText(/validity/i);
    fireEvent.change(validity, { target: { value: "730" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(getProfile("Code Signing")?.validityDays).toBe(730));
  });

  it("deletes a profile from the danger zone", async () => {
    renderAt("/profiles/Code Signing");
    fireEvent.click(screen.getByRole("button", { name: /delete profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));
    await waitFor(() => expect(getProfile("Code Signing")).toBeUndefined());
    expect(screen.getByText("profiles list")).toBeInTheDocument();
  });

  it("redirects an unknown profile to the list", () => {
    renderAt("/profiles/Nope");
    expect(screen.getByText("profiles list")).toBeInTheDocument();
  });
});
