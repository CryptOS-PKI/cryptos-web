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
import { describe, expect, it } from "vitest";

import { NodeAuditLog } from "@/components/node-audit-log";
import { expectNoA11yViolations } from "@/test/axe";

describe("NodeAuditLog", () => {
  it("has no axe violations", async () => {
    const { container } = render(<NodeAuditLog nodeName="acme-issuing-01" />);
    await screen.findByRole("button", { name: "Verify chain" });
    await expectNoA11yViolations(container);
  });

  it("lists the node's own audit entries", async () => {
    render(<NodeAuditLog nodeName="acme-issuing-01" />);
    expect(
      await screen.findByText(/Issued a leaf certificate on acme-issuing-01/),
    ).toBeInTheDocument();
  });

  it("verify chain reports the demo log as intact", async () => {
    render(<NodeAuditLog nodeName="acme-issuing-01" />);
    await screen.findByText(/Issued a leaf certificate/);
    fireEvent.click(screen.getByRole("button", { name: "Verify chain" }));
    expect(await screen.findByText(/Chain intact across/)).toBeInTheDocument();
  });
});
