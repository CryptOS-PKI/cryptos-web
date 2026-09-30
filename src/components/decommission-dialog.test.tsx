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

import { DecommissionDialog } from "@/components/decommission-dialog";

const decommissionNode = vi.fn();
vi.mock("@/lib/decommission", () => ({
  decommissionNode: (...a: unknown[]) => decommissionNode(...a),
}));

const CN = "ACME Root CA G1";
const decommissionButton = () => screen.getByRole("button", { name: /^decommission$/i });

const renderDialog = () =>
  render(
    <DecommissionDialog nodeName="acme-edge-07" onClose={vi.fn()} onDone={vi.fn()} rootCaCn={CN} />,
  );

describe("DecommissionDialog", () => {
  beforeEach(() => {
    decommissionNode.mockReset();
    decommissionNode.mockImplementation(() => Promise.resolve());
  });

  it("keeps Decommission disabled until the CN matches and the acknowledgement is ticked", () => {
    renderDialog();
    expect(decommissionButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type the root ca cn/i), { target: { value: CN } });
    expect(decommissionButton()).toBeDisabled(); // still no acknowledgement

    fireEvent.click(screen.getByRole("checkbox"));
    expect(decommissionButton()).toBeEnabled();
  });

  it("stays disabled when the typed CN does not match", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/type the root ca cn/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(decommissionButton()).toBeDisabled();
  });

  it("on confirm calls decommissionNode with the echoed CN and shows maintenance", async () => {
    const onDone = vi.fn();
    render(
      <DecommissionDialog
        nodeName="acme-edge-07"
        onClose={vi.fn()}
        onDone={onDone}
        rootCaCn={CN}
      />,
    );
    fireEvent.change(screen.getByLabelText(/type the root ca cn/i), { target: { value: CN } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(decommissionButton());

    await waitFor(() => expect(decommissionNode).toHaveBeenCalledWith("acme-edge-07", CN));
    await waitFor(() => expect(screen.getByText(/entering maintenance/i)).toBeInTheDocument());
    expect(onDone).toHaveBeenCalled();
  });

  it("surfaces a server-side permission error inline", async () => {
    decommissionNode.mockRejectedValue(new Error("permission denied: CN mismatch"));
    renderDialog();
    fireEvent.change(screen.getByLabelText(/type the root ca cn/i), { target: { value: CN } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(decommissionButton());
    await waitFor(() => expect(screen.getByText(/mismatch/i)).toBeInTheDocument());
  });
});
