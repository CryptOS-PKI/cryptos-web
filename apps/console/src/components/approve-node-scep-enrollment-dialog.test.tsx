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

import { ApproveNodeScepEnrollmentDialog } from "@/components/approve-node-scep-enrollment-dialog";
import { expectNoA11yViolations } from "@/test/axe";

const approveNodeScepEnrollment = vi.fn();
vi.mock("@/lib/node-scep-enrollments", () => ({
  approveNodeScepEnrollment: (...a: unknown[]) => approveNodeScepEnrollment(...a),
}));

const approveButton = () => screen.getByRole("button", { name: /^approve$/i });

const renderDialog = () =>
  render(
    <ApproveNodeScepEnrollmentDialog
      enrollmentId="enr-1"
      nodeName="acme-edge-07"
      onClose={vi.fn()}
      onDone={vi.fn()}
      profile="network-device"
      subjectDn="CN=switch-1.example.org"
    />,
  );

describe("ApproveNodeScepEnrollmentDialog", () => {
  beforeEach(() => {
    approveNodeScepEnrollment.mockReset();
    approveNodeScepEnrollment.mockResolvedValue("0a1b2c3d");
  });

  it("has no axe violations", async () => {
    renderDialog();
    await expectNoA11yViolations(document.body);
  });

  it("approves with the enrolment id and shows the issued serial", async () => {
    const onDone = vi.fn();
    render(
      <ApproveNodeScepEnrollmentDialog
        enrollmentId="enr-1"
        nodeName="acme-edge-07"
        onClose={vi.fn()}
        onDone={onDone}
        profile="network-device"
        subjectDn="CN=switch-1.example.org"
      />,
    );
    fireEvent.click(approveButton());

    await waitFor(() =>
      expect(approveNodeScepEnrollment).toHaveBeenCalledWith("acme-edge-07", "enr-1"),
    );
    expect(await screen.findByText("0a1b2c3d")).toBeInTheDocument();
    expect(onDone).toHaveBeenCalled();
  });

  it("surfaces a server-side refusal inline", async () => {
    approveNodeScepEnrollment.mockRejectedValue(new Error("no such enrolment"));
    renderDialog();
    fireEvent.click(approveButton());
    await waitFor(() => expect(screen.getByText(/no such enrolment/i)).toBeInTheDocument());
  });
});
