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

import { NodeScepChallenges } from "@/components/node-scep-challenges";
import { expectNoA11yViolations } from "@/test/axe";

let level: "admin" | "operator" | "viewer" = "operator";
vi.mock("@/context/auth", () => ({
  useOptionalAuth: () => ({
    operator: { commonName: "op@acme.example", level, serial: "AA" },
    status: "authenticated",
  }),
}));

describe("NodeScepChallenges", () => {
  beforeEach(() => {
    level = "operator";
  });

  it("has no axe violations", async () => {
    const { container } = render(<NodeScepChallenges nodeName="acme-issuing-01" />);
    await screen.findByText("ch-mock-1");
    await expectNoA11yViolations(container);
  });

  it("lists the node's SCEP challenges", async () => {
    render(<NodeScepChallenges nodeName="acme-issuing-01" />);
    expect(await screen.findByText("ch-mock-1")).toBeInTheDocument();
  });

  it("shows Mint and Revoke to an operator", async () => {
    render(<NodeScepChallenges nodeName="acme-issuing-01" />);
    await screen.findByText("ch-mock-1");
    expect(screen.getByRole("button", { name: /mint challenge/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^revoke$/i })).toBeInTheDocument();
  });

  // Was hidden entirely for a viewer; #196 moves both to the kit's lock
  // pattern so a viewer still sees them and why they're unavailable.
  it("locks Mint and Revoke for a viewer instead of hiding them", async () => {
    level = "viewer";
    render(<NodeScepChallenges nodeName="acme-issuing-01" />);
    await screen.findByText("ch-mock-1");
    const mint = screen.getByRole("button", { name: /mint challenge/i });
    const revoke = screen.getByRole("button", { name: /^revoke/i });
    for (const button of [mint, revoke]) {
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription(/needs the operator role/i);
      fireEvent.click(button);
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
