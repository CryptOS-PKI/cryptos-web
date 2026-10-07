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
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as icons from "./index";

// Built from fileURLToPath rather than `new URL(literal, import.meta.url)`:
// Vite's import-analysis plugin statically rewrites that exact pattern into a
// dev-server asset URL (its bundled-asset convention), which readdirSync can't
// open.
const assetsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../assets/icons");

describe("the generated icon set", () => {
  it("exports one component per source SVG", () => {
    const names = readdirSync(assetsDir).filter((f) => f.endsWith(".svg"));
    expect(Object.keys(icons).filter((k) => k.startsWith("Icon")).length).toBe(names.length);
  });

  it("is decorative without a title and named with one", () => {
    const { container, rerender } = render(<icons.IconCopy />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    rerender(<icons.IconCopy title="Copy" />);
    expect(screen.getByRole("img", { name: "Copy" })).toBeInTheDocument();
  });

  it("carries no embedded metadata", () => {
    const { container } = render(<icons.IconCopy />);
    expect(container.innerHTML).not.toMatch(/c2pa|metadata/i);
  });
});
