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
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { TrustConfirmPanel } from "./trust-confirm-panel";

const FP = "3F2A9C4107BED5A06E13C8F72B94E01D5A6C83F20D47B9E51C087FA3D26B4E90";

describe("TrustConfirmPanel", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <TrustConfirmPanel
        fingerprint={FP}
        label="Trust this node"
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("renders the fingerprint in groups of four with a copy action", () => {
    render(
      <TrustConfirmPanel
        fingerprint={FP}
        label="Trust this node"
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("group", { name: "SHA-256 fingerprint, 16 groups of four" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3F2A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy fingerprint" })).toBeInTheDocument();
  });

  it("disables Confirm while busy", () => {
    render(
      <TrustConfirmPanel
        busy
        fingerprint={FP}
        label="Trust this node"
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Confirming/ })).toBeDisabled();
  });

  it("calls onConfirm when Confirm is pressed", () => {
    const onConfirm = vi.fn();
    render(
      <TrustConfirmPanel
        fingerprint={FP}
        label="Trust this node"
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onReject when Reject is pressed", () => {
    const onReject = vi.fn();
    render(
      <TrustConfirmPanel
        fingerprint={FP}
        label="Trust this node"
        onConfirm={vi.fn()}
        onReject={onReject}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledOnce();
  });
});
