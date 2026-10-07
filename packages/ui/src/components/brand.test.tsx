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
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { CryptosMark, FleetosMark, Wordmark } from "./brand";

describe("brand", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <>
        <FleetosMark />
        <Wordmark product="FleetOS" />
      </>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no axe violations when labelled", async () => {
    const { container } = render(<CryptosMark title="CryptOS" />);
    await expectNoA11yViolations(container);
  });

  it("draws the marks as decorative unless labelled", () => {
    const { container } = render(<FleetosMark />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    render(<CryptosMark title="CryptOS" />);
    expect(screen.getByRole("img", { name: "CryptOS" })).toBeInTheDocument();
  });

  it("sets the wordmark with OS in the primary colour", () => {
    render(<Wordmark product="FleetOS" />);
    const word = screen.getByText("Fleet");
    expect(word.parentElement).toHaveTextContent("FleetOS");
    expect(screen.getByText("OS")).toHaveClass("text-primary");
  });
});
