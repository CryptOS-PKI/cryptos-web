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

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RootMark } from "@/components/root-mark";

// The shield glyph, from an escape (matches the source convention).
const SHIELD = "\u{1F6E1}\u{FE0F}";

// A CSP-safe, self-contained placeholder logo (data URI, no external host).
const DATA_LOGO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'></svg>";

const renderInSvg = (node: React.ReactNode) => {
  return render(<svg>{node}</svg>);
};

describe("RootMark", () => {
  it("falls back to the CryptOS shield when no logo URL is set", () => {
    const { container } = renderInSvg(<RootMark logoUrl={undefined} />);
    expect(container.querySelector("image")).toBeNull();
    expect(container.querySelector("text")?.textContent).toBe(SHIELD);
  });

  it("renders an operator logo image when a logo URL is provided", () => {
    const { container } = renderInSvg(<RootMark logoUrl={DATA_LOGO} />);
    const image = container.querySelector("image");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("href")).toBe(DATA_LOGO);
    expect(container.querySelector("text")).toBeNull();
  });
});
