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
import { FileText } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the title, body, illustration and action", () => {
    render(
      <EmptyState
        action={<button type="button">Issue certificate</button>}
        body="Certificates issued by any node in the fleet appear here."
        icon={FileText}
        title="No certificates yet"
      />,
    );
    expect(screen.getByRole("heading", { name: "No certificates yet" })).toBeInTheDocument();
    expect(
      screen.getByText("Certificates issued by any node in the fleet appear here."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Issue certificate" })).toBeInTheDocument();
  });

  it("uses the danger tone for errors and announces them", () => {
    render(
      <EmptyState
        body="The Fleet Manager API could not be reached."
        title="Couldn't load certificates"
        tone="danger"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load certificates");
  });

  it("is a plain region otherwise", () => {
    render(<EmptyState title="No nodes." />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No nodes." })).toBeInTheDocument();
  });

  it("renders a footnote", () => {
    render(<EmptyState footnote="Filtered to nothing." title="No rows" />);
    expect(screen.getByText("Filtered to nothing.")).toBeInTheDocument();
  });
});
