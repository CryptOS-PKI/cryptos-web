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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiagnosticsCopy } from "@/components/layout/diagnostics-copy";

const build = {
  buildDate: "2026-09-22T09:00:00Z",
  commit: "abc1234",
  version: "v1.2.3",
  webRef: "deadbeef",
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <DiagnosticsCopy />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => build, ok: true }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DiagnosticsCopy", () => {
  // No AuthProvider is mounted here on purpose: the action has to work on the
  // landing page and the denial screens, which is where the reports worth
  // having come from (#83).
  it("copies a report without a session", async () => {
    // Typed like the real clipboard method. An untyped `vi.fn(async () => {})`
    // gives mock.calls the element type `[]`, which makes the read of
    // calls[0][0] further down a type error -- one that only `tsc -b` reports,
    // so it fails the production build and not `vitest run`.
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: "probe/1.0" });

    renderAt("/fleet?role=root");
    fireEvent.click(screen.getByRole("button", { name: /copy diagnostics/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^copied$/i })).toBeInTheDocument();
    });
    const copied = writeText.mock.calls[0]?.[0] ?? "";
    expect(copied).toContain("v1.2.3");
    expect(copied).toContain("/fleet?role=root");
    expect(copied).toContain("probe/1.0");
  });

  // The clipboard API needs a secure context and a granted permission, and an
  // operator on a self-signed bootstrap certificate may have neither. Losing
  // the report would defeat the point.
  it("shows the text when the clipboard refuses", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      userAgent: "probe/1.0",
    });

    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /copy diagnostics/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not reach the clipboard/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/v1\.2\.3/)).toBeInTheDocument();
  });
});
