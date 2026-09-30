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

import { RevokeDialog } from "@/components/revoke-dialog";
import { __resetCerts, certsFor, issueCert } from "@/lib/certs";

describe("RevokeDialog", () => {
  beforeEach(() => __resetCerts());

  it("revokes with the chosen reason and closes", async () => {
    const cert = await issueCert("acme-issuing-01", {
      kind: "leaf",
      subjectCn: "x.acme.example",
      validityDays: 30,
    });
    const onClose = vi.fn();
    render(<RevokeDialog onClose={onClose} serial={cert.serial} subjectCn={cert.subjectCn} />);
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "superseded" } });
    fireEvent.click(screen.getByRole("button", { name: /^revoke$/i }));
    expect(certsFor("acme-issuing-01").find((c) => c.serial === cert.serial)?.status).toBe(
      "REVOKED",
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
