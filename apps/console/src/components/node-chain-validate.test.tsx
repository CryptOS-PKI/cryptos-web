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

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OperatorLevel } from "@/context/auth";

const mockOperator = vi.fn<() => { level: OperatorLevel } | null>(() => ({ level: "operator" }));
vi.mock("@/context/auth", () => ({
  useOptionalAuth: () => ({ operator: mockOperator(), status: "authenticated" }),
}));

import { NodeChainValidate } from "@/components/node-chain-validate";
import { expectNoA11yViolations } from "@/test/axe";

describe("NodeChainValidate", () => {
  beforeEach(() => {
    mockOperator.mockReturnValue({ level: "operator" });
  });

  it("has no axe violations", async () => {
    const { container } = render(<NodeChainValidate nodeName="acme-issuing-01" />);
    await expectNoA11yViolations(container);
  });

  it("reports a pasted certificate as chaining to the node's CA", async () => {
    render(<NodeChainValidate nodeName="acme-issuing-01" />);
    fireEvent.change(screen.getByLabelText(/certificate/i), {
      target: { value: "-----BEGIN CERTIFICATE-----\nmock\n-----END CERTIFICATE-----" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(await screen.findByText(/chains to acme-issuing-01's ca/i)).toBeInTheDocument();
  });

  it("reports an untrusted certificate with its reason", async () => {
    render(<NodeChainValidate nodeName="acme-issuing-01" />);
    fireEvent.change(screen.getByLabelText(/certificate/i), {
      target: { value: "-----BEGIN CERTIFICATE-----\nUNTRUSTED\n-----END CERTIFICATE-----" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(
      await screen.findByText(/certificate's issuer does not match the node's CA/),
    ).toBeInTheDocument();
  });

  it("disables the form for a viewer", () => {
    mockOperator.mockReturnValue({ level: "viewer" });
    render(<NodeChainValidate nodeName="acme-issuing-01" />);
    expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
