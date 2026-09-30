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

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { __resetAudit, auditList } from "@/lib/audit";
import { AuditPage } from "@/pages/audit";

describe("AuditPage", () => {
  beforeEach(() => __resetAudit());

  it("renders seeded events newest-first and a target link", () => {
    render(
      <MemoryRouter>
        <AuditPage />
      </MemoryRouter>,
    );
    const newest = auditList()[0];
    const [firstBody] = [...screen.getByRole("table").querySelectorAll("tbody tr")];
    expect(within(firstBody as HTMLElement).getByText(newest.summary)).toBeInTheDocument();

    expect(screen.getByText(/Enabled ACME/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Enabled ACME/i })).toHaveAttribute(
      "href",
      "/protocols/acme",
    );
  });

  it("narrows to issued via the Kind facet, hiding a revoked row", () => {
    render(
      <MemoryRouter>
        <AuditPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Revoked svc-9/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter Kind"), { target: { value: "issued" } });

    expect(screen.getByText(/Issued leaf svc-1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Revoked svc-9/i)).not.toBeInTheDocument();
  });
});
