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

import { Badge, StatusBadge } from "./badge";

describe("Badge", () => {
  it("renders a square mono tag", () => {
    render(<Badge variant="tag">leaf</Badge>);
    const tag = screen.getByText("leaf");
    expect(tag).toHaveClass("font-mono");
    expect(tag).toHaveClass("rounded");
  });

  it("keeps the semantic variants", () => {
    render(<Badge variant="success">ok</Badge>);
    expect(screen.getByText("ok")).toHaveClass("text-success");
  });

  it("renders the primary tag for the current level", () => {
    render(<Badge variant="tag-primary">admin</Badge>);
    expect(screen.getByText("admin")).toHaveClass("text-primary");
  });
});

describe("StatusBadge", () => {
  it.each([
    ["established", "text-success"],
    ["valid", "text-success"],
    ["pending", "text-warning"],
    ["expiring", "text-warning"],
    ["expired", "text-destructive"],
    ["revoked", "text-destructive"],
    ["denied", "text-destructive"],
    ["approved", "text-success"],
    ["retired", "text-muted-foreground"],
    ["info", "text-primary"],
  ] as const)("gives %s its tone and a shape icon", (status, tone) => {
    render(<StatusBadge status={status}>{status}</StatusBadge>);
    const badge = screen.getByText(status).closest("[data-status]");
    expect(badge).toHaveAttribute("data-status", status);
    expect(badge).toHaveClass(tone === "text-muted-foreground" ? tone : `dark:${tone}`);
    const icon = badge?.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass(tone);
  });

  it("uses the status as the label when no children are given", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("pending")).toBeInTheDocument();
  });
});
