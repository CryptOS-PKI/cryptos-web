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

import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { FleetTopology } from "@/components/fleet-topology";

// The camera lives in a transform on the zoom group, so the rendered scale is
// the observable: asserting on it proves whether a gesture moved the view.
const scaleOf = (container: HTMLElement): string => {
  const g = container.querySelector("g[transform*='scale']");
  return g?.getAttribute("transform") ?? "";
};

const renderMap = () =>
  render(
    <MemoryRouter>
      <FleetTopology focus={null} onFocus={() => {}} selected="" />
    </MemoryRouter>,
  );

describe("FleetTopology zoom", () => {
  // The bug: scrolling the page past the map zoomed it out, because the map
  // took every wheel event that happened over it (#84).
  it("ignores a plain wheel so the page keeps scrolling", () => {
    const { container } = renderMap();
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("no svg rendered");
    const before = scaleOf(container);

    fireEvent.wheel(svg, { deltaY: -240 });

    expect(scaleOf(container)).toBe(before);
  });

  it("zooms on ctrl+wheel", () => {
    const { container } = renderMap();
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("no svg rendered");
    const before = scaleOf(container);

    fireEvent.wheel(svg, { ctrlKey: true, deltaY: -240 });

    expect(scaleOf(container)).not.toBe(before);
  });

  // Trackpad pinch arrives as a wheel event with ctrlKey set, so it is the
  // same path; metaKey covers cmd on macOS.
  it("zooms on meta+wheel", () => {
    const { container } = renderMap();
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("no svg rendered");
    const before = scaleOf(container);

    fireEvent.wheel(svg, { deltaY: -240, metaKey: true });

    expect(scaleOf(container)).not.toBe(before);
  });
});
