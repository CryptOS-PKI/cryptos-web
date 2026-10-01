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

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NodeDetailPage } from "@/pages/node-detail";

// A freshly adopted subordinate reports AWAITING_CERT with no cn and no issuer
// until its parent signs it. Its established parent sits beside it.
const listNodesResult = {
  nodes: [
    {
      address: "10.0.0.10:50051",
      cn: "Lab Root CA",
      health: 1,
      healthDetail: "",
      identityState: "ESTABLISHED",
      issuer: "Lab Root CA",
      name: "lab-root",
      role: "root",
    },
    {
      address: "10.0.0.11:50051",
      cn: "",
      health: 1,
      healthDetail: "",
      identityState: "AWAITING_CERT",
      issuer: "",
      name: "lab-sub",
      role: "intermediate",
    },
    {
      address: "10.0.0.12:50051",
      cn: "Lab Issuing CA",
      health: 1,
      healthDetail: "",
      identityState: "ESTABLISHED",
      issuer: "Lab Root CA",
      name: "lab-issuing",
      role: "issuing",
    },
  ],
};

const listCertificatesResult = {
  certificates: [
    {
      issuerNode: "lab-issuing",
      kind: "leaf",
      notAfter: "2027-01-01T00:00:00Z",
      notBefore: "2026-01-01T00:00:00Z",
      profile: "",
      reason: "",
      revokedAt: "",
      serial: "AA11",
      status: "VALID",
      subjectCn: "web.lab.example",
    },
  ],
};

// Both reads resolve from fixtures; the page used to throw "Maximum update
// depth exceeded" here because the per-node cert snapshot was a fresh array on
// every read.
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({
    listCertificates: () => Promise.resolve(listCertificatesResult),
    listNodes: () => Promise.resolve(listNodesResult),
  }),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<NodeDetailPage />} path="/nodes/:name" />
      </Routes>
    </MemoryRouter>,
  );

describe("NodeDetailPage live", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_FLEET_MODE", "live");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders an awaiting-cert node with no identity yet", async () => {
    renderAt("/nodes/lab-sub");
    expect(await screen.findByRole("heading", { name: "lab-sub" })).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Certificates")).toBeInTheDocument();
  });

  it("renders an established node", async () => {
    renderAt("/nodes/lab-issuing");
    expect(await screen.findByRole("heading", { name: "lab-issuing" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "AA11" })).toBeInTheDocument();
  });
});
