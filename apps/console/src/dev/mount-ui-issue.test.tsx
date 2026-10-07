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

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { matchRoute, mountUiIssue } from "./mount-ui-issue";

const setMetaTag = (content: null | string) => {
  document.querySelector('meta[name="cryptos-dev-ui-issue-copy"]')?.remove();
  if (content === null) {
    return;
  }
  const meta = document.createElement("meta");
  meta.setAttribute("name", "cryptos-dev-ui-issue-copy");
  meta.setAttribute("content", content);
  document.head.append(meta);
};

const originalSha = import.meta.env.VITE_GIT_SHA;

afterEach(() => {
  setMetaTag(null);
  document.body.innerHTML = "";
  import.meta.env.VITE_GIT_SHA = originalSha;
});

describe("mountUiIssue", () => {
  // The build flag alone (main.tsx's gated dynamic import) is not enough: the
  // manager also has to advertise the meta tag at runtime. Both gates missing
  // here, since only a build with the flag on ever reaches this function.
  it("does not render the button without the meta tag", () => {
    mountUiIssue();
    expect(screen.queryByTestId("dev-ui-issue-copy")).not.toBeInTheDocument();
  });

  it("renders the button once the meta tag is present", () => {
    setMetaTag("true");
    act(() => {
      mountUiIssue();
    });
    expect(screen.getByTestId("dev-ui-issue-copy")).toBeInTheDocument();
  });

  it('ignores a meta tag whose content is not exactly "true"', () => {
    setMetaTag("1");
    mountUiIssue();
    expect(screen.queryByTestId("dev-ui-issue-copy")).not.toBeInTheDocument();
  });

  it("marks its container with the UI-issue marker, for Task 9's bundle check", () => {
    setMetaTag("true");
    act(() => {
      mountUiIssue();
    });
    const button = screen.getByTestId("dev-ui-issue-copy");
    expect(button.closest("[data-cryptos-dev-ui-issue]")).toBeInTheDocument();
  });

  it("tracks the last clicked app element, not the copy button's own click", async () => {
    const appButton = document.createElement("button");
    appButton.dataset.testid = "app-thing";
    document.body.append(appButton);

    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText }, language: "en-US", userAgent: "UA" });

    setMetaTag("true");
    act(() => {
      mountUiIssue();
    });

    fireEvent.click(appButton);
    fireEvent.click(screen.getByTestId("dev-ui-issue-copy"));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const bundle = JSON.parse(writeText.mock.calls[0]?.[0] ?? "{}");
    expect(bundle.clicked).toBe("app-thing");

    vi.unstubAllGlobals();
  });

  it("includes sha in the bundle when VITE_GIT_SHA is defined", async () => {
    import.meta.env.VITE_GIT_SHA = "deadbeef";

    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText }, language: "en-US", userAgent: "UA" });

    setMetaTag("true");
    act(() => {
      mountUiIssue();
    });
    fireEvent.click(screen.getByTestId("dev-ui-issue-copy"));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const bundle = JSON.parse(writeText.mock.calls[0]?.[0] ?? "{}");
    expect(bundle.sha).toBe("deadbeef");

    vi.unstubAllGlobals();
  });
});

describe("matchRoute", () => {
  it("matches a known route pattern", () => {
    expect(matchRoute("/nodes/n1/certs/abc")).toEqual({
      params: { name: "n1", serial: "abc" },
      route: "/nodes/:name/certs/:serial",
    });
  });

  // An unmatched path must never be echoed back raw: it could carry a serial
  // or another identifier (as it does here).
  it("collapses an unmatched path, even one carrying a serial, to *", () => {
    expect(matchRoute("/debug/certs/4F:9A:11:02")).toEqual({ params: {}, route: "*" });
  });
});
