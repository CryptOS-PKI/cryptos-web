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

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NodeDetailPanel } from "@/components/node-detail-panel";
import { mockNodes } from "@/lib/mock";

let level: "admin" | "operator" | "viewer" = "admin";
vi.mock("@/context/auth", () => ({
  useOptionalAuth: () => ({
    operator: { commonName: "op@acme.example", level, serial: "AA" },
    status: "authenticated",
  }),
}));

const rootNode = () => mockNodes.find((n) => n.role === "root")!;

const renderPanel = () =>
  render(
    <MemoryRouter>
      <NodeDetailPanel node={rootNode()} />
    </MemoryRouter>,
  );

describe("NodeDetailPanel escrow actions", () => {
  beforeEach(() => {
    level = "admin";
  });

  it("shows Export/Import key and Decommission actions to an admin", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /export key/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import key/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decommission/i })).toBeInTheDocument();
  });

  it("hides escrow and decommission actions from a non-admin operator", () => {
    level = "operator";
    renderPanel();
    expect(screen.queryByRole("button", { name: /export key/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /import key/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /decommission/i })).not.toBeInTheDocument();
  });
});
