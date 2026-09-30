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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RekeyWizard } from "@/components/rekey-wizard";
import { mockNodes, type Node } from "@/lib/mock";

const issuingNode = (): Node => mockNodes.find((n) => n.name === "acme-issuing-01")!;
const rootNode = (): Node => mockNodes.find((n) => n.name === "acme-root-01")!;

const rekeyNode = vi.fn();
let mode: "live" | "mock" = "mock";

vi.mock("@/lib/rekey", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rekey")>("@/lib/rekey");
  return { ...actual, rekeyNode: (...args: [string, string]) => rekeyNode(...args) };
});
vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => mode }));

describe("RekeyWizard (mock)", () => {
  beforeEach(() => {
    mode = "mock";
    rekeyNode.mockReset();
  });

  it("advances through the demo steps to completion without any RPC", () => {
    render(<RekeyWizard node={issuingNode()} />);
    for (let i = 0; i < 4; i += 1) {
      const next = screen.queryByRole("button", { name: /next|sign|install|generate/i });
      if (next) fireEvent.click(next);
    }
    expect(screen.getByText(/re-key complete/i)).toBeInTheDocument();
    expect(rekeyNode).not.toHaveBeenCalled();
  });
});

describe("RekeyWizard (live)", () => {
  beforeEach(() => {
    mode = "live";
    rekeyNode.mockReset().mockResolvedValue({
      chainLen: 2,
      issuerCn: "ACME Intermediate CA",
      subjectCn: "ACME Issuing CA",
    });
  });

  it("re-keys through a single RPC and renders the new identity on success", async () => {
    render(<RekeyWizard node={issuingNode()} />);
    fireEvent.click(screen.getByRole("button", { name: /re-key/i }));

    await waitFor(() =>
      expect(rekeyNode).toHaveBeenCalledWith("acme-issuing-01", expect.any(String)),
    );
    expect(await screen.findByText(/ACME Issuing CA/)).toBeInTheDocument();
    expect(screen.getByText(/ACME Intermediate CA/)).toBeInTheDocument();
  });

  it("surfaces an RPC error inline and does not advance", async () => {
    rekeyNode.mockRejectedValue(new Error("parent not in fleet"));
    render(<RekeyWizard node={issuingNode()} />);
    fireEvent.click(screen.getByRole("button", { name: /re-key/i }));

    expect(await screen.findByText(/parent not in fleet/i)).toBeInTheDocument();
    expect(screen.queryByText(/re-key complete/i)).not.toBeInTheDocument();
  });

  it("does not offer re-key for a root CA and makes no RPC", () => {
    render(<RekeyWizard node={rootNode()} />);
    expect(screen.getByText(/only for subordinate CAs/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /re-key/i })).not.toBeInTheDocument();
    expect(rekeyNode).not.toHaveBeenCalled();
  });
});
