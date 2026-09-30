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
import { describe, expect, it, vi } from "vitest";

import { AuditPage } from "@/pages/audit";

const listAudit = vi.fn();
vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => "live" }));
vi.mock("@/lib/fleet/client", () => ({ fleetClient: () => ({ listAudit }) }));

const blank = {
  actorCn: "",
  actorKind: "",
  actorSerial: "",
  keyId: "",
  outcome: "",
  targetKind: "",
  targetPath: "",
  tool: "",
  via: "",
};

describe("AuditPage (live)", () => {
  it("shows who acted, through which surface and tool, and the outcome", async () => {
    listAudit.mockResolvedValue({
      items: [
        {
          ...blank,
          actorCn: "operator@example.org",
          actorKind: "mcp_key",
          at: "2026-09-28T10:00:00Z",
          id: "aud-2",
          keyId: "key-1",
          kind: "issued",
          outcome: "denied",
          summary: "Issued leaf svc.example.org",
          targetKind: "cert",
          tool: "cert_issue_from_csr",
          via: "mcp",
        },
        {
          ...blank,
          actorCn: "operator@example.org",
          actorKind: "cert",
          at: "2026-09-28T09:00:00Z",
          id: "aud-1",
          kind: "mcp-key-created",
          outcome: "ok",
          summary: "Created agent key build agent",
          targetKind: "mcp-key",
          via: "web",
        },
        {
          ...blank,
          at: "2026-09-01T00:00:00Z",
          id: "aud-0",
          kind: "config-applied",
          summary: "Config applied before actors were recorded",
        },
      ],
    });

    render(
      <MemoryRouter>
        <AuditPage />
      </MemoryRouter>,
    );

    const mcpCell = await screen.findByText("Issued leaf svc.example.org");
    const mcpRow = mcpCell.closest("tr")!;
    const mcp = within(mcpRow as HTMLElement);
    expect(mcp.getByText("operator@example.org")).toBeInTheDocument();
    expect(mcp.getByText("agent key")).toBeInTheDocument();
    expect(mcp.getByText("mcp")).toBeInTheDocument();
    expect(mcp.getByText("cert_issue_from_csr")).toBeInTheDocument();
    expect(mcp.getByText("denied")).toBeInTheDocument();

    const keyRow = within(screen.getByText("Created agent key build agent").closest("tr")!);
    expect(keyRow.getByText("mcp key created")).toBeInTheDocument();
    expect(keyRow.getByText("mcp-key")).toBeInTheDocument();
    expect(keyRow.getByText("certificate")).toBeInTheDocument();

    // Entries recorded before the manager captured an actor carry no actor
    // fields, which must read as unknown rather than as blank cells.
    const oldRow = within(
      screen.getByText("Config applied before actors were recorded").closest("tr")!,
    );
    expect(oldRow.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});
