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

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShownOnceSecret } from "./shown-once-secret";

afterEach(() => vi.unstubAllGlobals());

describe("ShownOnceSecret", () => {
  it("shows the warning and the secret", () => {
    render(
      <ShownOnceSecret
        label="Agent key"
        onDone={() => {}}
        secret="fos_agent_k7Q2"
        warning="It will not be shown again."
      />,
    );
    expect(screen.getByText("It will not be shown again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent key")).toHaveTextContent("fos_agent_k7Q2");
  });

  it("copies the secret and shows Copied", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<ShownOnceSecret label="Agent key" onDone={() => {}} secret="s3cret" warning="w" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });
    expect(writeText).toHaveBeenCalledWith("s3cret");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("finishes with Done", () => {
    const onDone = vi.fn();
    render(<ShownOnceSecret label="Agent key" onDone={onDone} secret="s" warning="w" />);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
