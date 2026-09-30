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

import { McpKeyCreateDialog } from "@/components/mcp-key-create-dialog";

const createMcpKey = vi.fn();
vi.mock("@/lib/mcp-keys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mcp-keys")>()),
  createMcpKey: (...a: unknown[]) => createMcpKey(...a),
}));

const PLAINTEXT = "fos_mcp_ZXhhbXBsZS1rZXktbm90LXJlYWw";

describe("McpKeyCreateDialog", () => {
  beforeEach(() => {
    createMcpKey.mockReset();
    createMcpKey.mockResolvedValue({
      key: { id: "key-9", label: "build agent" },
      plaintextKey: PLAINTEXT,
    });
  });

  it("offers ceilings up to the operator's own level, defaulting to it", () => {
    render(<McpKeyCreateDialog level="operator" onClose={vi.fn()} onCreated={vi.fn()} />);
    const ceiling = screen.getByLabelText(/level ceiling/i) as HTMLSelectElement;
    expect(ceiling).toHaveValue("operator");
    expect([...ceiling.options].map((o) => o.value)).toEqual(["viewer", "operator"]);
  });

  it("creates the key and shows the plaintext once with a warning", async () => {
    const onCreated = vi.fn();
    render(<McpKeyCreateDialog level="admin" onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: "build agent" } });
    fireEvent.change(screen.getByLabelText(/level ceiling/i), { target: { value: "viewer" } });
    fireEvent.click(screen.getByRole("button", { name: /create key/i }));

    expect(await screen.findByText(PLAINTEXT)).toBeInTheDocument();
    expect(screen.getByText(/will not be shown again/i)).toBeInTheDocument();
    expect(createMcpKey).toHaveBeenCalledWith({ label: "build agent", levelCeiling: "viewer" });
    // The page only needs to know the list changed; it never receives the key.
    expect(onCreated).toHaveBeenCalledWith();
  });

  it("copies the key to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(null);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<McpKeyCreateDialog level="admin" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /create key/i }));
    fireEvent.click(await screen.findByRole("button", { name: /copy/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PLAINTEXT));
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("drops the key from the page when closed", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <McpKeyCreateDialog level="admin" onClose={onClose} onCreated={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /create key/i }));
    await screen.findByText(PLAINTEXT);
    fireEvent.click(screen.getByRole("button", { name: /done/i }));

    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText(PLAINTEXT)).not.toBeInTheDocument();
    rerender(<McpKeyCreateDialog level="admin" onClose={onClose} onCreated={vi.fn()} />);
    expect(screen.queryByText(PLAINTEXT)).not.toBeInTheDocument();
  });

  it("shows a create failure inline", async () => {
    createMcpKey.mockRejectedValueOnce(new Error("ceiling above your level"));
    render(<McpKeyCreateDialog level="viewer" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /create key/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ceiling above your level");
  });
});
