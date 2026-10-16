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
import { beforeEach, describe, expect, it } from "vitest";

import { __resetAdapters } from "@/lib/adapters";
import { __resetAudit, auditList } from "@/lib/audit";
import { __resetCerts } from "@/lib/certs";
import { __resetEnrollments } from "@/lib/enrollment";
import { __resetNodes } from "@/lib/nodes";
import { __resetProfiles } from "@/lib/profiles";
import { DashboardPage } from "@/pages/dashboard";
import { expectNoA11yViolations } from "@/test/axe";

const renderDash = () =>
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );

describe("DashboardPage", () => {
  beforeEach(() => {
    __resetNodes();
    __resetCerts();
    __resetEnrollments();
    __resetProfiles();
    __resetAdapters();
    __resetAudit();
  });

  it("has no axe violations", async () => {
    const { container } = renderDash();
    await expectNoA11yViolations(container);
  });

  it("cards link to their surfaces", () => {
    renderDash();
    expect(screen.getByRole("link", { name: /fleet/i })).toHaveAttribute("href", "/fleet");
    expect(screen.getByRole("link", { name: /certificates/i })).toHaveAttribute(
      "href",
      "/certificates",
    );
    expect(screen.getByRole("link", { name: /enrollment/i })).toHaveAttribute(
      "href",
      "/enrollment",
    );
    expect(screen.getByRole("link", { name: /protocols/i })).toHaveAttribute("href", "/protocols");
    expect(screen.getByRole("link", { name: /profiles/i })).toHaveAttribute("href", "/profiles");
    expect(screen.getByRole("link", { name: /recent activity/i })).toHaveAttribute(
      "href",
      "/audit",
    );
  });

  // #199: a sixth card keeps the grid even (no orphan last row) and gives the
  // operator a reason to look without leaving the dashboard.
  it("recent activity card shows the latest audit entry", () => {
    renderDash();
    const card = screen.getByTestId("card-recent-activity");
    expect(within(card).getByText(auditList()[0].summary)).toBeInTheDocument();
  });

  it("certificates card shows the expiring + expired counts from the seed", () => {
    renderDash();
    // seed variety: 2 expiring (ldap-a/ldap-b) + 1 expired (old)
    const card = screen.getByTestId("card-certificates");
    expect(within(card).getByText(/2 expiring/i)).toBeInTheDocument();
    expect(within(card).getByText(/1 expired/i)).toBeInTheDocument();
  });
});
