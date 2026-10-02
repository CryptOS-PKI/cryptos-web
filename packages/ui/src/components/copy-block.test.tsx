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

import { CopyBlock } from "./copy-block";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("CopyBlock", () => {
  it("shows the text under its label", () => {
    render(<CopyBlock label="CSR · PEM" text="-----BEGIN CERTIFICATE REQUEST-----" />);
    expect(screen.getByLabelText("CSR · PEM")).toHaveTextContent(
      "-----BEGIN CERTIFICATE REQUEST-----",
    );
  });

  it("copies the text and says so for a moment", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<CopyBlock label="CSR" text="abc" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy CSR" }));
    });
    expect(writeText).toHaveBeenCalledWith("abc");
    expect(screen.getByRole("button", { name: "Copy CSR" })).toHaveTextContent("Copied");
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByRole("button", { name: "Copy CSR" })).toHaveTextContent("Copy");
  });

  it("offers a download only with a filename and calls onDownload", () => {
    const onDownload = vi.fn();
    const { rerender } = render(<CopyBlock label="CSR" text="abc" />);
    expect(screen.queryByRole("button", { name: "Download CSR" })).not.toBeInTheDocument();
    rerender(<CopyBlock filename="node.csr" label="CSR" onDownload={onDownload} text="abc" />);
    fireEvent.click(screen.getByRole("button", { name: "Download CSR" }));
    expect(onDownload).toHaveBeenCalledWith("node.csr", "abc");
  });

  it("downloads through a blob link when no onDownload is given", () => {
    const createObjectURL = vi.fn(() => "blob:x");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<CopyBlock filename="node.csr" label="CSR" text="abc" />);
    fireEvent.click(screen.getByRole("button", { name: "Download CSR" }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});
