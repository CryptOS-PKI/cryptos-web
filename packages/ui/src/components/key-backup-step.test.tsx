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

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { KeyBackupStep } from "./key-backup-step";

const setup = () => {
  const onDownload = vi.fn();
  const onContinue = vi.fn();
  render(
    <KeyBackupStep
      filename="alice@example.org.key.enc"
      onContinue={onContinue}
      onDownload={onDownload}
      passphrase="cobalt-quarry-tundra-9-lantern"
      warning="Save the key backup and its passphrase."
    />,
  );
  return { onContinue, onDownload };
};

describe("KeyBackupStep", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <KeyBackupStep
        filename="alice@example.org.key.enc"
        onContinue={() => {}}
        onDownload={() => {}}
        passphrase="cobalt-quarry-tundra-9-lantern"
        warning="Save the key backup and its passphrase."
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("shows the passphrase once, with the warning", () => {
    setup();
    expect(screen.getByText("Save the key backup and its passphrase.")).toBeInTheDocument();
    expect(screen.getByLabelText("Key backup passphrase")).toHaveTextContent(
      "cobalt-quarry-tundra-9-lantern",
    );
  });

  it("enables Continue only after the download and the checkbox", () => {
    const { onContinue, onDownload } = setup();
    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "I have saved the passphrase" }));
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Download key backup/ }));
    expect(onDownload).toHaveBeenCalledOnce();
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("names the backup file on the download button", () => {
    setup();
    expect(
      screen.getByRole("button", { name: /alice@example\.org\.key\.enc/ }),
    ).toBeInTheDocument();
  });
});
