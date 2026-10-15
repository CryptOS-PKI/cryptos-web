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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RollbackNodeImageDialog } from "@/components/rollback-node-image-dialog";
import { expectNoA11yViolations } from "@/test/axe";

const rollbackNodeImage = vi.fn();
vi.mock("@/lib/node-image", () => ({
  rollbackNodeImage: (...a: unknown[]) => rollbackNodeImage(...a),
}));

const rollbackButton = () => screen.getByRole("button", { name: /^roll back$/i });

const renderDialog = () =>
  render(<RollbackNodeImageDialog nodeName="acme-edge-07" onClose={vi.fn()} onDone={vi.fn()} />);

describe("RollbackNodeImageDialog", () => {
  beforeEach(() => {
    rollbackNodeImage.mockReset();
    rollbackNodeImage.mockImplementation(() => Promise.resolve());
  });

  it("has no axe violations", async () => {
    renderDialog();
    await expectNoA11yViolations(document.body);
  });

  it("confirms the rollback and calls onDone", async () => {
    const onDone = vi.fn();
    render(<RollbackNodeImageDialog nodeName="acme-edge-07" onClose={vi.fn()} onDone={onDone} />);
    fireEvent.click(rollbackButton());

    await waitFor(() => expect(rollbackNodeImage).toHaveBeenCalledWith("acme-edge-07"));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("surfaces a server-side refusal inline", async () => {
    rollbackNodeImage.mockRejectedValue(new Error("no previous image to roll back to"));
    renderDialog();
    fireEvent.click(rollbackButton());
    await waitFor(() => expect(screen.getByText(/no previous image/i)).toBeInTheDocument());
  });
});
