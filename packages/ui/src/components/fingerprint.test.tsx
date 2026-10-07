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
import {
  compareFingerprints,
  Fingerprint,
  FingerprintConfirm,
  fingerprintGroups,
} from "./fingerprint";

const FP = "3F2A9C4107BED5A06E13C8F72B94E01D5A6C83F20D47B9E51C087FA3D26B4E90";

describe("fingerprintGroups", () => {
  it("normalises colons, spaces and case into groups of four", () => {
    const colons = FP.match(/../g)!.join(":").toLowerCase();
    expect(fingerprintGroups(colons)).toEqual(fingerprintGroups(FP));
    expect(fingerprintGroups(FP)).toHaveLength(16);
    expect(fingerprintGroups(FP)[0]).toBe("3F2A");
  });
});

describe("compareFingerprints", () => {
  it("matches the same value in any format", () => {
    expect(compareFingerprints(FP, FP.toLowerCase()).match).toBe(true);
  });

  it("names the groups that differ", () => {
    const pasted = FP.replace("2B94", "2B49");
    expect(compareFingerprints(FP, pasted)).toEqual({ differing: [6], match: false });
  });

  it("does not match a shorter value", () => {
    expect(compareFingerprints(FP, FP.slice(0, 32)).match).toBe(false);
  });
});

describe("Fingerprint", () => {
  it("has no axe violations", async () => {
    const { container } = render(<Fingerprint value={FP} />);
    await expectNoA11yViolations(container);
  });

  it("is read as sixteen groups of four", () => {
    render(<Fingerprint value={FP} />);
    expect(
      screen.getByRole("group", { name: "SHA-256 fingerprint, 16 groups of four" }),
    ).toBeInTheDocument();
  });

  it("numbers the groups at the large size so two people can read it aloud", () => {
    render(<Fingerprint size="large" value={FP} />);
    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByText("E01D")).toBeInTheDocument();
  });

  it("shortens to first … last at the short size", () => {
    render(<Fingerprint size="short" value={FP} />);
    expect(screen.getByText("3F2A 9C41 … 4E90")).toBeInTheDocument();
  });

  it("copies the normalised value", () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<Fingerprint copyable value={FP.toLowerCase()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy fingerprint" }));
    expect(writeText).toHaveBeenCalledWith(fingerprintGroups(FP).join(" "));
    vi.unstubAllGlobals();
  });
});

describe("FingerprintConfirm", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <FingerprintConfirm
        actions={
          <button onClick={() => {}} type="button">
            Confirm fingerprint
          </button>
        }
        fingerprint={FP}
        step="Step 1 of 2"
        subject={[["subject", "CN=maintenance,O=CryptOS"]]}
        title="First contact"
        tone="warning"
      >
        Confirm this is the node you expect before trusting it.
      </FingerprintConfirm>,
    );
    await expectNoA11yViolations(container);
  });

  it("shows the title, step, subject and fingerprint with its actions", () => {
    const onConfirm = vi.fn();
    render(
      <FingerprintConfirm
        actions={
          <button onClick={onConfirm} type="button">
            Confirm fingerprint
          </button>
        }
        fingerprint={FP}
        step="Step 1 of 2"
        subject={[["subject", "CN=maintenance,O=CryptOS"]]}
        title="First contact"
        tone="warning"
      >
        Confirm this is the node you expect before trusting it.
      </FingerprintConfirm>,
    );
    const panel = screen.getByRole("region", { name: "First contact" });
    expect(panel).toHaveAttribute("data-tone", "warning");
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("CN=maintenance,O=CryptOS")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm fingerprint" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("compares a pasted value and reports the differing group", () => {
    const onCompare = vi.fn();
    render(
      <FingerprintConfirm
        compare
        fingerprint={FP}
        onCompare={onCompare}
        title="Check"
        tone="warning"
      />,
    );
    const input = screen.getByRole("textbox", { name: "Paste the fingerprint to compare" });
    fireEvent.change(input, { target: { value: FP.replace("2B94", "2B49") } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That fingerprint doesn't match. Group 7 differs. Don't confirm.",
    );
    expect(onCompare).toHaveBeenLastCalledWith(false);
    fireEvent.change(input, { target: { value: FP } });
    expect(screen.getByRole("status")).toHaveTextContent("All 16 groups match.");
    expect(onCompare).toHaveBeenLastCalledWith(true);
  });
});
