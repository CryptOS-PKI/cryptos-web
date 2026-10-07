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

import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { mountUiIssue } from "./mount-ui-issue";

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

afterEach(() => {
  setMetaTag(null);
  document.body.innerHTML = "";
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
});
