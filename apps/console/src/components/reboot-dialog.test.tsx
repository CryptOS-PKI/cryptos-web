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

import { RebootDialog } from "@/components/reboot-dialog";

const rebootNode = vi.fn();
vi.mock("@/lib/reboot", () => ({
  rebootNode: (...a: unknown[]) => rebootNode(...a),
}));

const CN = "ACME Issuing CA G1";
const rebootButton = () => screen.getByRole("button", { name: /^reboot$/i });

const renderDialog = (rebootRequired = false) =>
  render(
    <RebootDialog
      caCn={CN}
      nodeName="acme-edge-07"
      onClose={vi.fn()}
      onDone={vi.fn()}
      rebootRequired={rebootRequired}
    />,
  );

describe("RebootDialog", () => {
  beforeEach(() => {
    rebootNode.mockReset();
    rebootNode.mockImplementation(() => Promise.resolve());
  });

  it("keeps Reboot disabled until the CN matches", () => {
    renderDialog();
    expect(rebootButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/type the ca cn/i), { target: { value: CN } });
    expect(rebootButton()).toBeEnabled();
  });

  it("stays disabled when the typed CN does not match", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/type the ca cn/i), { target: { value: "wrong" } });
    expect(rebootButton()).toBeDisabled();
  });

  it("on confirm calls rebootNode with the echoed CN and power_off false, and shows rebooting", async () => {
    const onDone = vi.fn();
    render(
      <RebootDialog
        caCn={CN}
        nodeName="acme-edge-07"
        onClose={vi.fn()}
        onDone={onDone}
        rebootRequired={false}
      />,
    );
    fireEvent.change(screen.getByLabelText(/type the ca cn/i), { target: { value: CN } });
    fireEvent.click(rebootButton());

    await waitFor(() => expect(rebootNode).toHaveBeenCalledWith("acme-edge-07", CN, false));
    await waitFor(() => expect(screen.getByText(/rebooting/i)).toBeInTheDocument());
    expect(onDone).toHaveBeenCalled();
  });

  it("checking power off relabels the action and calls rebootNode with power_off true", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/type the ca cn/i), { target: { value: CN } });
    fireEvent.click(screen.getByLabelText(/power off/i));
    fireEvent.click(screen.getByRole("button", { name: /^power off$/i }));

    await waitFor(() => expect(rebootNode).toHaveBeenCalledWith("acme-edge-07", CN, true));
  });

  it("surfaces a server-side permission error inline", async () => {
    rebootNode.mockRejectedValue(new Error("permission denied: CN mismatch"));
    renderDialog();
    fireEvent.change(screen.getByLabelText(/type the ca cn/i), { target: { value: CN } });
    fireEvent.click(rebootButton());
    await waitFor(() => expect(screen.getByText(/mismatch/i)).toBeInTheDocument());
  });

  it("calls out that a reboot is needed when rebootRequired is set", () => {
    renderDialog(true);
    expect(screen.getByText(/reboot is needed/i)).toBeInTheDocument();
  });
});
