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

import { Field } from "./field";
import { Input } from "./input";

describe("Field", () => {
  it("labels its control", () => {
    render(
      <Field label="Endpoint (host:port)">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Endpoint (host:port)")).toBeInTheDocument();
  });

  it("describes the control with the help text", () => {
    render(
      <Field help="Comma-separated IPv4 or IPv6." label="DNS nameservers">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("DNS nameservers")).toHaveAccessibleDescription(
      "Comma-separated IPv4 or IPv6.",
    );
  });

  it("shows the error in place of the help, as an alert, and marks the control invalid", () => {
    render(
      <Field error="Bootstrap token not accepted." help="From the node console." label="Token">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Token");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Bootstrap token not accepted.");
    expect(screen.getByRole("alert")).toHaveTextContent("Bootstrap token not accepted.");
    expect(screen.queryByText("From the node console.")).not.toBeInTheDocument();
  });

  it("shows a badge next to the label", () => {
    render(
      <Field badge="NEEDS REBOOT" label="DNS nameservers">
        <Input />
      </Field>,
    );
    expect(screen.getByText("NEEDS REBOOT")).toBeInTheDocument();
  });

  it("keeps an id the control already has", () => {
    render(
      <Field label="Name">
        <Input id="own-id" />
      </Field>,
    );
    expect(screen.getByLabelText("Name")).toHaveAttribute("id", "own-id");
  });
});
