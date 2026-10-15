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

import { StageNodeImageDialog } from "@/components/stage-node-image-dialog";
import { expectNoA11yViolations } from "@/test/axe";

const stageNodeImage = vi.fn();
vi.mock("@/lib/node-image", () => ({
  stageNodeImage: (...a: unknown[]) => stageNodeImage(...a),
}));

const stageButton = () => screen.getByRole("button", { name: /^stage$/i });
const signatureFile = new File([new Uint8Array([1, 2, 3, 4])], "release.sig");

const renderDialog = () =>
  render(<StageNodeImageDialog nodeName="acme-edge-07" onClose={vi.fn()} onDone={vi.fn()} />);

describe("StageNodeImageDialog", () => {
  beforeEach(() => {
    stageNodeImage.mockReset();
    stageNodeImage.mockImplementation(() => Promise.resolve());
  });

  it("has no axe violations", async () => {
    renderDialog();
    await expectNoA11yViolations(document.body);
  });

  it("keeps Stage disabled until a URL and a signature file are both set", async () => {
    renderDialog();
    expect(stageButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/image url/i), {
      target: { value: "https://images.example.org/cryptos.img" },
    });
    expect(stageButton()).toBeDisabled();

    const fileInput = screen.getByLabelText(/release signature/i) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [signatureFile] } });
    await waitFor(() => expect(stageButton()).toBeEnabled());
  });

  it("on confirm calls stageNodeImage with the url, signature bytes and sha256", async () => {
    const onDone = vi.fn();
    render(<StageNodeImageDialog nodeName="acme-edge-07" onClose={vi.fn()} onDone={onDone} />);

    fireEvent.change(screen.getByLabelText(/image url/i), {
      target: { value: "https://images.example.org/cryptos.img" },
    });
    fireEvent.change(screen.getByLabelText(/release signature/i), {
      target: { files: [signatureFile] },
    });
    await waitFor(() => expect(stageButton()).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/sha-256/i), { target: { value: "deadbeef" } });
    fireEvent.click(stageButton());

    await waitFor(() =>
      expect(stageNodeImage).toHaveBeenCalledWith("acme-edge-07", {
        imageUrl: "https://images.example.org/cryptos.img",
        sha256: "deadbeef",
        signature: new Uint8Array([1, 2, 3, 4]),
      }),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("surfaces a server-side refusal inline (e.g. one upgrade at a time)", async () => {
    stageNodeImage.mockRejectedValue(new Error("another upgrade is already in progress"));
    renderDialog();
    fireEvent.change(screen.getByLabelText(/image url/i), {
      target: { value: "https://images.example.org/cryptos.img" },
    });
    fireEvent.change(screen.getByLabelText(/release signature/i), {
      target: { files: [signatureFile] },
    });
    await waitFor(() => expect(stageButton()).toBeEnabled());
    fireEvent.click(stageButton());
    await waitFor(() => expect(screen.getByText(/already in progress/i)).toBeInTheDocument());
  });
});
