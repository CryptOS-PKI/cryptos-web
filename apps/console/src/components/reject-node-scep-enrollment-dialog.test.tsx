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

import { RejectNodeScepEnrollmentDialog } from "@/components/reject-node-scep-enrollment-dialog";
import { expectNoA11yViolations } from "@/test/axe";

const rejectNodeScepEnrollment = vi.fn();
vi.mock("@/lib/node-scep-enrollments", () => ({
  rejectNodeScepEnrollment: (...a: unknown[]) => rejectNodeScepEnrollment(...a),
}));

const rejectButton = () => screen.getByRole("button", { name: /^reject$/i });

const renderDialog = () =>
  render(
    <RejectNodeScepEnrollmentDialog
      enrollmentId="enr-1"
      nodeName="acme-edge-07"
      onClose={vi.fn()}
      onDone={vi.fn()}
      subjectDn="CN=switch-1.example.org"
    />,
  );

describe("RejectNodeScepEnrollmentDialog", () => {
  beforeEach(() => {
    rejectNodeScepEnrollment.mockReset();
    rejectNodeScepEnrollment.mockImplementation(() => Promise.resolve());
  });

  it("has no axe violations", async () => {
    renderDialog();
    await expectNoA11yViolations(document.body);
  });

  it("rejects with the enrolment id and the typed reason", async () => {
    const onDone = vi.fn();
    render(
      <RejectNodeScepEnrollmentDialog
        enrollmentId="enr-1"
        nodeName="acme-edge-07"
        onClose={vi.fn()}
        onDone={onDone}
        subjectDn="CN=switch-1.example.org"
      />,
    );
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "unexpected device" } });
    fireEvent.click(rejectButton());

    await waitFor(() =>
      expect(rejectNodeScepEnrollment).toHaveBeenCalledWith(
        "acme-edge-07",
        "enr-1",
        "unexpected device",
      ),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("surfaces a server-side refusal inline", async () => {
    rejectNodeScepEnrollment.mockRejectedValue(new Error("no such enrolment"));
    renderDialog();
    fireEvent.click(rejectButton());
    await waitFor(() => expect(screen.getByText(/no such enrolment/i)).toBeInTheDocument());
  });
});
