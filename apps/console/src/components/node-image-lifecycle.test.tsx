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
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NodeImageLifecycle } from "@/components/node-image-lifecycle";
import { expectNoA11yViolations } from "@/test/axe";

let level: "admin" | "operator" | "viewer" = "admin";
vi.mock("@/context/auth", () => ({
  useOptionalAuth: () => ({
    operator: { commonName: "op@acme.example", level, serial: "AA" },
    status: "authenticated",
  }),
}));

describe("NodeImageLifecycle", () => {
  beforeEach(() => {
    level = "admin";
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <NodeImageLifecycle caCn="ACME Issuing CA G1" nodeName="acme-issuing-01" />,
    );
    await screen.findByText(/running/i);
    await expectNoA11yViolations(container);
  });

  it("shows the running and active image digests", async () => {
    render(<NodeImageLifecycle caCn="ACME Issuing CA G1" nodeName="acme-issuing-01" />);
    expect(await screen.findAllByText(/7c3a9e2f1b6d/i)).not.toHaveLength(0);
  });

  it("shows Stage, Activate and Roll back to an admin", async () => {
    render(<NodeImageLifecycle caCn="ACME Issuing CA G1" nodeName="acme-issuing-01" />);
    await screen.findByText(/running/i);
    expect(screen.getByRole("button", { name: /stage image/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /activate image/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /roll back/i })).toBeInTheDocument();
  });

  it("hides every action from a non-admin operator", async () => {
    level = "operator";
    render(<NodeImageLifecycle caCn="ACME Issuing CA G1" nodeName="acme-issuing-01" />);
    await screen.findByText(/running/i);
    expect(screen.queryByRole("button", { name: /stage image/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /activate image/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /roll back/i })).not.toBeInTheDocument();
  });
});
