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

import { ActivateNodeImageDialog } from "@/components/activate-node-image-dialog";
import { expectNoA11yViolations } from "@/test/axe";

const activateNodeImage = vi.fn();
vi.mock("@/lib/node-image", () => ({
  activateNodeImage: (...a: unknown[]) => activateNodeImage(...a),
}));

const CN = "ACME Issuing CA G1";
const activateButton = () => screen.getByRole("button", { name: /^activate$/i });

const renderDialog = () =>
  render(
    <ActivateNodeImageDialog
      caCn={CN}
      nodeName="acme-edge-07"
      onClose={vi.fn()}
      onDone={vi.fn()}
    />,
  );

describe("ActivateNodeImageDialog", () => {
  beforeEach(() => {
    activateNodeImage.mockReset();
    activateNodeImage.mockImplementation(() => Promise.resolve());
  });

  it("has no axe violations", async () => {
    renderDialog();
    await expectNoA11yViolations(document.body);
  });

  it("keeps Activate disabled until the CN matches", () => {
    renderDialog();
    expect(activateButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/type the ca cn/i), { target: { value: CN } });
    expect(activateButton()).toBeEnabled();
  });

  it("stays disabled when the typed CN does not match", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/type the ca cn/i), { target: { value: "wrong" } });
    expect(activateButton()).toBeDisabled();
  });

  it("on confirm calls activateNodeImage with the echoed CN and shows activating", async () => {
    const onDone = vi.fn();
    render(
      <ActivateNodeImageDialog
        caCn={CN}
        nodeName="acme-edge-07"
        onClose={vi.fn()}
        onDone={onDone}
      />,
    );
    fireEvent.change(screen.getByLabelText(/type the ca cn/i), { target: { value: CN } });
    fireEvent.click(activateButton());

    await waitFor(() => expect(activateNodeImage).toHaveBeenCalledWith("acme-edge-07", CN));
    await waitFor(() => expect(screen.getByText(/activating/i)).toBeInTheDocument());
    expect(onDone).toHaveBeenCalled();
  });

  it("surfaces a server-side refusal inline", async () => {
    activateNodeImage.mockRejectedValue(new Error("permission denied: CN mismatch"));
    renderDialog();
    fireEvent.change(screen.getByLabelText(/type the ca cn/i), { target: { value: CN } });
    fireEvent.click(activateButton());
    await waitFor(() => expect(screen.getByText(/mismatch/i)).toBeInTheDocument());
  });
});
