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

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetNodes } from "@/lib/nodes";
import { ProtocolsPage } from "@/pages/protocols";

// The auth gate is mocked to an admin so the page's admin-only affordances
// would render if the list page offered any (the switch itself lives on the
// detail page).
vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    operator: { commonName: "admin@acme.example", level: "admin", serial: "AA" },
    status: "authenticated",
  }),
}));

const rowFor = (name: RegExp) => screen.getByRole("link", { name }).closest("tr") as HTMLElement;

describe("ProtocolsPage", () => {
  beforeEach(() => __resetNodes());

  it("lists every protocol, linking to its detail page", () => {
    render(
      <MemoryRouter>
        <ProtocolsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /ACME/ })).toHaveAttribute("href", "/protocols/acme");
    expect(screen.getByRole("link", { name: /EST/ })).toHaveAttribute("href", "/protocols/est");
    expect(screen.getByRole("link", { name: /SCEP/ })).toHaveAttribute("href", "/protocols/scep");
    expect(screen.getByRole("link", { name: /Windows autoenrollment/ })).toHaveAttribute(
      "href",
      "/protocols/ms-autoenroll",
    );
  });

  // The fixture has 4 eligible (ESTABLISHED issuing) nodes; 2 report ACME
  // running and 1 reports EST running with the other reboot-pending (#84: the
  // page now reads this from the nodes themselves, not a fleet-wide catalog).
  it("counts nodes actually serving each implemented protocol", () => {
    render(
      <MemoryRouter>
        <ProtocolsPage />
      </MemoryRouter>,
    );
    expect(within(rowFor(/^ACME/)).getByText(/2 of 4/)).toBeInTheDocument();
    expect(within(rowFor(/^EST/)).getByText(/1 of 4/)).toBeInTheDocument();
    expect(within(rowFor(/^EST/)).getByText(/1 reboot pending/i)).toBeInTheDocument();
  });

  // SCEP and Windows autoenrollment have no node contract (cryptos#185, #108):
  // the page says so instead of a zero count that reads as "the fleet serves
  // nothing" (#84 acceptance: honest about what isn't wired up).
  it("marks SCEP and Windows autoenrollment as not wired up, with no count", () => {
    render(
      <MemoryRouter>
        <ProtocolsPage />
      </MemoryRouter>,
    );
    expect(within(rowFor(/^SCEP/)).getByText(/not wired up/i)).toBeInTheDocument();
    expect(
      within(rowFor(/^Windows autoenrollment/)).getByText(/not wired up/i),
    ).toBeInTheDocument();
  });

  it("does not claim a protocol ships in a later release when it already shipped", () => {
    render(
      <MemoryRouter>
        <ProtocolsPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/ships in a later release/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/services ship/i)).not.toBeInTheDocument();
  });
});
