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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Separator } from "./separator";

describe("Card", () => {
  it("renders its parts", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Fleet health</CardTitle>
          <CardDescription>7 nodes</CardDescription>
        </CardHeader>
        <CardContent>body</CardContent>
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveClass("bg-card");
    expect(screen.getByText("Fleet health")).toBeInTheDocument();
    expect(screen.getByText("7 nodes")).toBeInTheDocument();
  });
});

describe("Separator", () => {
  it("is a horizontal separator by default and decorative when asked", () => {
    const { rerender } = render(<Separator />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal");
    rerender(<Separator decorative orientation="vertical" />);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });
});
