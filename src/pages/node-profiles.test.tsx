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

import type { MachineConfig } from "@/gen/fleet/cryptos/v1/config_pb";
import type { CertProfile } from "@/lib/profiles";

import { NodeProfilesPage } from "@/pages/node-profiles";

const getNodeConfig = vi.fn();
const applyProfileToNode = vi.fn();
const catalog: CertProfile[] = [
  {
    extKeyUsage: ["server_auth"],
    extraExtensions: [],
    isCA: false,
    keyAlg: "ECDSA-P384",
    keyUsage: ["digital_signature"],
    name: "TLS Server (LDAPS)",
    sans: { dns: [], email: [], ip: [], uri: [] },
    subject: { commonName: "", country: "", organization: "" },
    validityDays: 365,
  },
];

vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => "live" }));
vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    operator: { commonName: "admin@acme.example", level: "admin", serial: "AA" },
    status: "authenticated",
  }),
}));
vi.mock("@/lib/config", () => ({
  getNodeConfig: (...args: unknown[]) => getNodeConfig(...args),
}));
vi.mock("@/lib/nodes", () => ({
  useNode: (name: string) => ({ identityState: "ESTABLISHED", name }),
}));
vi.mock("@/lib/profiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profiles")>();
  return {
    ...actual,
    applyProfileToNode: (...args: unknown[]) => applyProfileToNode(...args),
    useProfiles: () => catalog,
  };
});

// The node's applied config carries a same-named profile that differs from the
// catalog (validity), so it drifts and offers reconcile.
const driftedConfig = (): MachineConfig =>
  ({
    management: { managerCn: "fm-op", trustPem: "t" },
    pki: {
      profiles: [
        {
          basicConstraints: { isCa: false },
          extKeyUsage: ["server_auth"],
          extraExtensions: [],
          keyAlg: "ECDSA-P384",
          keyUsage: ["digital_signature"],
          name: "TLS Server (LDAPS)",
          validityDays: 90,
        },
      ],
    },
  }) as unknown as MachineConfig;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<NodeProfilesPage />} path="/nodes/:name/profiles" />
        <Route element={<div>node hub</div>} path="/nodes/:name" />
      </Routes>
    </MemoryRouter>,
  );

describe("NodeProfilesPage drift view", () => {
  beforeEach(() => {
    getNodeConfig.mockReset().mockResolvedValue(driftedConfig());
    applyProfileToNode.mockReset().mockResolvedValue({ generation: 3, requiresReboot: false });
  });

  it("shows a drifted row with an Apply catalog version button that reconciles", async () => {
    renderAt("/nodes/acme-issuing-01/profiles");

    expect(await screen.findByText("Drifted")).toBeInTheDocument();
    const apply = screen.getByRole("button", { name: /apply catalog version/i });
    fireEvent.click(apply);

    await waitFor(() =>
      expect(applyProfileToNode).toHaveBeenCalledWith("acme-issuing-01", "TLS Server (LDAPS)"),
    );
    // Reconcile refetches the node config to reflect the applied state.
    await waitFor(() => expect(getNodeConfig).toHaveBeenCalledTimes(2));
  });
});
