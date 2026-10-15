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

import { NodeScepEnrollments } from "@/components/node-scep-enrollments";
import { expectNoA11yViolations } from "@/test/axe";

let level: "admin" | "operator" | "viewer" = "operator";
vi.mock("@/context/auth", () => ({
  useOptionalAuth: () => ({
    operator: { commonName: "op@acme.example", level, serial: "AA" },
    status: "authenticated",
  }),
}));

describe("NodeScepEnrollments", () => {
  beforeEach(() => {
    level = "operator";
  });

  it("has no axe violations", async () => {
    const { container } = render(<NodeScepEnrollments nodeName="acme-issuing-01" />);
    await screen.findByText("CN=switch-1.example.org");
    await expectNoA11yViolations(container);
  });

  it("lists the node's pending enrolments", async () => {
    render(<NodeScepEnrollments nodeName="acme-issuing-01" />);
    expect(await screen.findByText("CN=switch-1.example.org")).toBeInTheDocument();
  });

  it("shows Approve and Reject to an operator", async () => {
    render(<NodeScepEnrollments nodeName="acme-issuing-01" />);
    await screen.findByText("CN=switch-1.example.org");
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
  });

  // Was hidden entirely for a viewer; #196 moves both to the kit's lock
  // pattern so a viewer still sees them and why they're unavailable.
  it("locks Approve and Reject for a viewer instead of hiding them", async () => {
    level = "viewer";
    render(<NodeScepEnrollments nodeName="acme-issuing-01" />);
    await screen.findByText("CN=switch-1.example.org");
    const approve = screen.getByRole("button", { name: /^approve/i });
    const reject = screen.getByRole("button", { name: /^reject/i });
    for (const button of [approve, reject]) {
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription(/needs the operator role/i);
      fireEvent.click(button);
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
