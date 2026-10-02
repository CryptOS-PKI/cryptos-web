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

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type BannerItem, BannerStack } from "./banner-stack";

const items: BannerItem[] = [
  {
    body: "Last attempt 4 minutes ago.",
    id: "ocsp",
    title: "OCSP responder unreachable",
    tone: "warning",
  },
  {
    body: "Example Operator CA has no CRL and no OCSP.",
    id: "rev",
    title: "CA revocations not observed",
    tone: "danger",
  },
  {
    action: { label: "Upload CRL…", onClick: vi.fn() },
    body: "The CRL expired 2 days ago.",
    id: "crl",
    title: "CRL expired",
    tone: "danger",
  },
  { body: "Fourth item.", id: "four", title: "Another warning", tone: "warning" },
];

describe("BannerStack", () => {
  it("renders nothing with no items", () => {
    const { container } = render(<BannerStack items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("puts danger items before warnings and shows three", () => {
    render(<BannerStack items={items} />);
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual([
      "CA revocations not observed",
      "CRL expired",
      "OCSP responder unreachable",
    ]);
  });

  it("collapses the rest into +N more and expands them", () => {
    render(<BannerStack items={items} />);
    const more = screen.getByRole("button", { name: "+1 more" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(screen.getByText("Another warning")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show fewer" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("runs an item's action", () => {
    render(<BannerStack items={items} />);
    const item = screen.getByText("CRL expired").closest("li") as HTMLElement;
    fireEvent.click(within(item).getByRole("button", { name: "Upload CRL…" }));
    expect(items[2].action?.onClick).toHaveBeenCalledOnce();
  });

  it("renders a link action with an href", () => {
    render(
      <BannerStack
        items={[
          {
            action: { href: "/operator-cas", label: "CRL source…" },
            id: "a",
            title: "T",
            tone: "danger",
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "CRL source…" })).toHaveAttribute(
      "href",
      "/operator-cas",
    );
  });

  it("honours a custom limit", () => {
    render(<BannerStack items={items} limit={1} />);
    expect(screen.getByRole("button", { name: "+3 more" })).toBeInTheDocument();
  });
});
