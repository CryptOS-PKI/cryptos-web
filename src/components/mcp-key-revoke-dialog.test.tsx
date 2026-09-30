/*
Apache License 2.0

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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { McpKeyRevokeDialog } from "@/components/mcp-key-revoke-dialog";

const revokeMcpKey = vi.fn();
vi.mock("@/lib/mcp-keys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mcp-keys")>()),
  revokeMcpKey: (...a: unknown[]) => revokeMcpKey(...a),
}));

const target = { id: "key-1", label: "build agent", operatorCn: "operator@example.org" };

describe("McpKeyRevokeDialog", () => {
  beforeEach(() => revokeMcpKey.mockReset());

  it("revokes only after the operator confirms", async () => {
    revokeMcpKey.mockResolvedValue(null);
    const onRevoked = vi.fn();
    const onClose = vi.fn();
    render(<McpKeyRevokeDialog onClose={onClose} onRevoked={onRevoked} target={target} />);

    expect(screen.getByText(/build agent/)).toBeInTheDocument();
    expect(revokeMcpKey).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^revoke$/i }));

    await waitFor(() => expect(onRevoked).toHaveBeenCalled());
    expect(revokeMcpKey).toHaveBeenCalledWith("key-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("cancels without revoking", () => {
    const onClose = vi.fn();
    render(<McpKeyRevokeDialog onClose={onClose} onRevoked={vi.fn()} target={target} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(revokeMcpKey).not.toHaveBeenCalled();
  });

  it("shows a revoke failure inline", async () => {
    revokeMcpKey.mockRejectedValueOnce(new Error("not your key"));
    render(<McpKeyRevokeDialog onClose={vi.fn()} onRevoked={vi.fn()} target={target} />);

    fireEvent.click(screen.getByRole("button", { name: /^revoke$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not your key");
  });
});
