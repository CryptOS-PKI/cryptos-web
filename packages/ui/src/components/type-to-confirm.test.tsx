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

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { typedMatches, TypeToConfirm } from "./type-to-confirm";

const Harness = ({ expected }: { expected: string | string[] }) => {
  const [value, setValue] = useState("");
  return (
    <>
      <TypeToConfirm expected={expected} onChange={setValue} value={value} />
      <button disabled={!typedMatches(value, expected)} type="button">
        Decommission
      </button>
    </>
  );
};

describe("typedMatches", () => {
  it("is an exact, case-sensitive match", () => {
    expect(typedMatches("node-02", "node-02")).toBe(true);
    expect(typedMatches("Node-02", "node-02")).toBe(false);
    expect(typedMatches("node-02 ", "node-02")).toBe(false);
  });

  it("accepts any of several values", () => {
    expect(typedMatches("EXPORT", ["node-02", "EXPORT"])).toBe(true);
  });
});

describe("TypeToConfirm", () => {
  it("has no axe violations", async () => {
    const { container } = render(<Harness expected="node-02" />);
    await expectNoA11yViolations(container);
  });

  it("names what to type and is labelled by it", () => {
    render(<Harness expected="Example Issuing CA G1" />);
    expect(screen.getByText("Example Issuing CA G1")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Type Example Issuing CA G1 to confirm/ }),
    ).toBeInTheDocument();
  });

  it("keeps the action disabled until the text matches", () => {
    render(<Harness expected="node-02" />);
    const action = screen.getByRole("button", { name: "Decommission" });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "node-0" } });
    expect(action).toBeDisabled();
    expect(screen.queryByTestId("confirm-match")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "node-02" } });
    expect(action).toBeEnabled();
    expect(screen.getByTestId("confirm-match")).toBeInTheDocument();
  });

  it("lists alternatives", () => {
    render(<Harness expected={["node-02", "EXPORT"]} />);
    expect(screen.getByText("EXPORT")).toBeInTheDocument();
    expect(screen.getByText("or")).toBeInTheDocument();
  });

  it("uses a custom label", () => {
    render(
      <TypeToConfirm
        expected="x"
        label="Type the Root CA CN to confirm"
        onChange={() => {}}
        value=""
      />,
    );
    expect(
      screen.getByRole("textbox", { name: /Type the Root CA CN to confirm/ }),
    ).toBeInTheDocument();
  });

  it("turns off autocomplete and spellcheck", () => {
    render(<Harness expected="node-02" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
  });
});
