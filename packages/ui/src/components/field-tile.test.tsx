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
import { describe, expect, it } from "vitest";

import { FieldTile, FieldTiles } from "./field-tile";

describe("FieldTile", () => {
  it("shows a label and a value", () => {
    render(
      <FieldTiles>
        <FieldTile label="TPM" value="SEALED" />
      </FieldTiles>,
    );
    const term = screen.getByRole("term");
    expect(term).toHaveTextContent("TPM");
    expect(screen.getByRole("definition")).toHaveTextContent("SEALED");
  });

  it("shows an em dash in muted text when empty", () => {
    render(
      <FieldTiles>
        <FieldTile label="Revocation reason" value={null} />
      </FieldTiles>,
    );
    const value = screen.getByRole("definition");
    expect(value).toHaveTextContent("—");
    expect(value.firstElementChild).toHaveClass("text-muted-foreground");
  });

  it("shows four items of a list and Show all N", () => {
    const sans = [
      "a.example.org",
      "b.example.org",
      "c.example.org",
      "d.example.org",
      "e.example.org",
    ];
    render(
      <FieldTiles>
        <FieldTile full label="SANs" value={sans} />
      </FieldTiles>,
    );
    expect(screen.queryByText(/e\.example\.org/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all 5" }));
    expect(screen.getByText(/e\.example\.org/)).toBeInTheDocument();
  });

  it("spans the row when full", () => {
    render(
      <FieldTiles columns={3}>
        <FieldTile full label="CRL URL" value="http://pki.example.org/crl" />
      </FieldTiles>,
    );
    expect(screen.getByRole("term").parentElement).toHaveClass("col-span-full");
  });
});
