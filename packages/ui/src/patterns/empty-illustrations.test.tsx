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

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { EmptyIllustration, type EmptyIllustrationKind } from "./empty-illustrations";

const KINDS: EmptyIllustrationKind[] = ["audit", "certificates", "generic", "nodes", "requests"];

describe("EmptyIllustration", () => {
  it.each(KINDS)("renders the %s drawing with no axe violations", async (kind) => {
    const { container } = render(<EmptyIllustration kind={kind} />);
    await expectNoA11yViolations(container);
  });

  it("is aria-hidden and carries no design-tool metadata", () => {
    const { container } = render(<EmptyIllustration kind="certificates" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("metadata")).not.toBeInTheDocument();
    // nodes, certificates and requests are ported from the brand set (stripped
    // of its metadata); audit and generic are hand-drawn placeholders pending
    // design review. None carries design-tool metadata, so this stays clean on
    // its own; the repo-wide CI step (ci-web.yml) is what actually enforces it.
    expect([...svg!.attributes].some((a) => a.name.startsWith("xmlns:"))).toBe(false);
  });

  it("draws a distinct shape for every kind", () => {
    const markup = KINDS.map((kind) => {
      const { container } = render(<EmptyIllustration kind={kind} />);
      return container.querySelector("svg")!.innerHTML;
    });
    expect(new Set(markup).size).toBe(KINDS.length);
  });
});
