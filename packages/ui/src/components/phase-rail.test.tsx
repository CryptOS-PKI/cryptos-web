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
import { describe, expect, it } from "vitest";

import { PhaseRail } from "./phase-rail";

describe("PhaseRail", () => {
  const phases = [
    {
      detail: "generation 1 accepted",
      id: "apply",
      label: "applying config",
      state: "done" as const,
    },
    {
      detail: "Compare with the Mgmt SHA-256 line",
      id: "fp",
      label: "awaiting fingerprint confirmation",
      state: "current" as const,
    },
    { id: "est", label: "established", state: "pending" as const },
  ];

  it("lists the phases in order with their state", () => {
    render(<PhaseRail label="Adoption progress" phases={phases} />);
    const list = screen.getByRole("list", { name: "Adoption progress" });
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByText("applying config").closest("li")).toHaveAttribute("data-state", "done");
    expect(screen.getByText("awaiting fingerprint confirmation").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("is a polite live region so phase changes are announced", () => {
    render(<PhaseRail label="Adoption progress" phases={phases} />);
    expect(screen.getByRole("list", { name: "Adoption progress" }).parentElement).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("shows a failed phase in red with its coded error", () => {
    render(
      <PhaseRail
        label="Adoption progress"
        phases={[
          {
            detail: "disk write error (error 1405)",
            id: "inst",
            label: "installing",
            state: "failed",
          },
        ]}
      />,
    );
    const item = screen.getByText("installing").closest("li");
    expect(item).toHaveAttribute("data-state", "failed");
    expect(screen.getByText("installing")).toHaveClass("text-destructive");
    expect(screen.getByText("disk write error (error 1405)")).toBeInTheDocument();
  });
});
