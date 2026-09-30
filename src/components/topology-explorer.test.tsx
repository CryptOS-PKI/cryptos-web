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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TopologyExplorer } from "@/components/topology-explorer";

// fleetClient is mocked so `live` mode never issues a real fetch in tests --
// listNodes hangs (never resolves), which is exactly the cold-load window
// (allNodes still empty on first render) this guard has to survive.
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({ listNodes: () => new Promise(() => {}) }),
}));

describe("TopologyExplorer cold load in live mode", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_FLEET_MODE", "live");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders a loading state instead of crashing when no nodes have arrived yet", () => {
    render(
      <MemoryRouter>
        <TopologyExplorer title="Fleet" />
      </MemoryRouter>,
    );

    expect(screen.getByText("0 Root · 0 nodes", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/loading fleet/i)).toBeInTheDocument();
  });
});
