/*
Apache License 2.0

Copyright 2026 Shane

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
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { FleetPage } from "@/pages/fleet";

const renderPage = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("FleetPage", () => {
  it("renders the topology graph with the Root on screen", () => {
    renderPage(<FleetPage />);
    expect(screen.getByRole("img", { name: /CA fleet topology graph/i })).toBeInTheDocument();
    expect(screen.getAllByText("ACME Root CA G1").length).toBeGreaterThan(0);
  });

  it("shows the default selected node's detail panel", () => {
    renderPage(<FleetPage />);
    expect(screen.getByText(/Node · acme-intermediate-01/)).toBeInTheDocument();
    expect(screen.getByText("142 / 4")).toBeInTheDocument();
  });

  it("focuses+selects a node on click and reveals the Overview control", () => {
    renderPage(<FleetPage />);
    fireEvent.click(screen.getByRole("button", { name: /ACME Issuing CA G01/i }));
    expect(screen.getByText(/Node · acme-issuing-01/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /overview/i })).toBeInTheDocument();
  });

  it("returns to the overview on Escape", () => {
    renderPage(<FleetPage />);
    fireEvent.click(screen.getByRole("button", { name: /ACME Issuing CA G01/i }));
    expect(screen.getByRole("button", { name: /overview/i })).toBeInTheDocument();
    fireEvent.keyDown(globalThis.document.body, { key: "Escape" });
    expect(screen.queryByRole("button", { name: /overview/i })).not.toBeInTheDocument();
  });

  it("always renders the CRL and OCSP fields (fixed panel, em-dash when absent)", () => {
    renderPage(<FleetPage />);
    // Default selection (intermediate G1) is established and has endpoints.
    expect(screen.getByText("crl")).toBeInTheDocument();
    expect(screen.getByText("ocsp")).toBeInTheDocument();
  });
});
