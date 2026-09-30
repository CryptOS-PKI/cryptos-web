/*
Apache License 2.0

Copyright 2026 Shane

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
import { beforeEach, describe, expect, it } from "vitest";

import { __resetCerts, allCerts, useCertCounts } from "@/lib/certs";

// A probe renders the derived tally for one issuer so the hook can be asserted
// without a live manager.
const Probe = ({ node }: { node: string }) => {
  const counts = useCertCounts();
  const entry = counts.get(node);

  return (
    <span data-testid="counts">
      {entry?.issued ?? 0}:{entry?.revoked ?? 0}
    </span>
  );
};

describe("useCertCounts", () => {
  beforeEach(() => {
    __resetCerts();
  });

  // The bug this exists for: NodeSummary carries no counts, so a live node
  // arrives with issued defaulted to 0 and every node showed "0 issued"
  // however many it had (#85). ListCertificates is correct, so the tally is
  // derived from it.
  it("tallies issued and revoked per issuing node", () => {
    const all = allCerts();
    const issuer = all[0]?.issuerNodeName;
    if (!issuer) throw new Error("fixture has no certificates");

    const expectedIssued = all.filter((c) => c.issuerNodeName === issuer).length;
    const expectedRevoked = all.filter(
      (c) => c.issuerNodeName === issuer && c.status === "REVOKED",
    ).length;

    render(<Probe node={issuer} />);

    expect(screen.getByTestId("counts").textContent).toBe(`${expectedIssued}:${expectedRevoked}`);
    // The point of the fix: a node that has issued something must not read 0.
    expect(expectedIssued).toBeGreaterThan(0);
  });

  // A node with nothing issued reads zero rather than undefined, so callers
  // can render it without a guard.
  it("reports nothing for a node that has issued nothing", () => {
    render(<Probe node="node-that-does-not-exist" />);

    expect(screen.getByTestId("counts").textContent).toBe("0:0");
  });
});
