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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { buildUiIssueBundle } from "./ui-issue";
import { UiIssueCopy } from "./ui-issue-copy";

const collect = () => ({
  dpr: 2,
  now: new Date("2026-10-06T18:00:00Z"),
  params: {},
  path: "/nodes/:nodeId",
  route: "/nodes/:nodeId",
  sha: "abc1234",
  ua: "UA",
  vh: 800,
  vw: 1280,
});

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  writeText = vi.fn(async () => {});
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UiIssueCopy", () => {
  it("has no axe violations", async () => {
    const { container } = render(<UiIssueCopy collect={collect} />);
    await expectNoA11yViolations(container);
  });

  it("copies the bundle and announces Copied in a status region", async () => {
    render(<UiIssueCopy collect={collect} />);

    fireEvent.click(screen.getByTestId("dev-ui-issue-copy"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(buildUiIssueBundle(collect()));
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Copied");
    });
  });
});
