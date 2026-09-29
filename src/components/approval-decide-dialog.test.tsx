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

import { ApprovalDecideDialog } from "@/components/approval-decide-dialog";

const decideApproval = vi.fn();
vi.mock("@/lib/approvals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/approvals")>()),
  decideApproval: (...a: unknown[]) => decideApproval(...a),
}));

const digest = "0123456789abcdef".repeat(4);
const target = {
  id: "ap-1",
  requestDigest: digest,
  requestedByCn: "operator@example.org",
  requiredLevel: "operator",
  summary: "Revoke certificate 0a1b on issuing-1",
  tool: "cert_revoke",
};

describe("ApprovalDecideDialog", () => {
  beforeEach(() => decideApproval.mockReset());

  it("repeats the summary and the full request digest before approving", async () => {
    decideApproval.mockResolvedValue({ ...target, status: "approved" });
    const onDecided = vi.fn();
    const onClose = vi.fn();
    render(
      <ApprovalDecideDialog approve onClose={onClose} onDecided={onDecided} target={target} />,
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("Revoke certificate 0a1b on issuing-1");
    expect(screen.getByRole("dialog")).toHaveTextContent(digest);
    expect(decideApproval).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => expect(onDecided).toHaveBeenCalled());
    expect(decideApproval).toHaveBeenCalledWith({ approve: true, id: "ap-1" });
    expect(onClose).toHaveBeenCalled();
  });

  it("denies through the same confirmation", async () => {
    decideApproval.mockResolvedValue({ ...target, status: "denied" });
    const onDecided = vi.fn();
    render(
      <ApprovalDecideDialog
        approve={false}
        onClose={vi.fn()}
        onDecided={onDecided}
        target={target}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveTextContent(digest);
    fireEvent.click(screen.getByRole("button", { name: /^deny$/i }));

    await waitFor(() => expect(onDecided).toHaveBeenCalled());
    expect(decideApproval).toHaveBeenCalledWith({ approve: false, id: "ap-1" });
  });

  it("cancels without deciding", () => {
    const onClose = vi.fn();
    render(<ApprovalDecideDialog approve onClose={onClose} onDecided={vi.fn()} target={target} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(decideApproval).not.toHaveBeenCalled();
  });

  it("shows a refusal inline and stays open", async () => {
    decideApproval.mockRejectedValueOnce(new Error("approval expired"));
    const onClose = vi.fn();
    render(<ApprovalDecideDialog approve onClose={onClose} onDecided={vi.fn()} target={target} />);

    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("approval expired");
    expect(onClose).not.toHaveBeenCalled();
  });
});
