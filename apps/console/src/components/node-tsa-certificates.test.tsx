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
import { afterEach, describe, expect, it, vi } from "vitest";

import { NodeTsaCertificates } from "@/components/node-tsa-certificates";
import { expectNoA11yViolations } from "@/test/axe";

vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({ listNodeTsaCertificates: () => Promise.resolve({ certificates: [] }) }),
}));

describe("NodeTsaCertificates", () => {
  it("has no axe violations", async () => {
    const { container } = render(<NodeTsaCertificates nodeName="acme-issuing-01" />);
    await screen.findByText("0a1b2c3d");
    await expectNoA11yViolations(container);
  });

  it("lists the node's TSA certificates and marks the current one", async () => {
    render(<NodeTsaCertificates nodeName="acme-issuing-01" />);
    expect(await screen.findByText("0a1b2c3d")).toBeInTheDocument();
    expect(screen.getAllByText("Current")).toHaveLength(1);
  });

  describe("while the node's TSA is not running (live mode)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("shows an empty state instead of an empty table", async () => {
      vi.stubEnv("VITE_FLEET_MODE", "live");
      render(<NodeTsaCertificates nodeName="acme-issuing-01" />);
      expect(await screen.findByText(/not running/i)).toBeInTheDocument();
    });
  });
});
