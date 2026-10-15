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

import { RevokeNodeScepChallengeDialog } from "@/components/revoke-node-scep-challenge-dialog";
import { expectNoA11yViolations } from "@/test/axe";

const revokeNodeScepChallenge = vi.fn();
vi.mock("@/lib/node-scep-challenges", () => ({
  revokeNodeScepChallenge: (...a: unknown[]) => revokeNodeScepChallenge(...a),
}));

const revokeButton = () => screen.getByRole("button", { name: /^revoke$/i });

const renderDialog = () =>
  render(
    <RevokeNodeScepChallengeDialog
      challengeId="ch-1"
      nodeName="acme-edge-07"
      onClose={vi.fn()}
      onDone={vi.fn()}
      profile="network-device"
    />,
  );

describe("RevokeNodeScepChallengeDialog", () => {
  beforeEach(() => {
    revokeNodeScepChallenge.mockReset();
    revokeNodeScepChallenge.mockImplementation(() => Promise.resolve());
  });

  it("has no axe violations", async () => {
    renderDialog();
    await expectNoA11yViolations(document.body);
  });

  it("confirms the revoke with the challenge id and calls onDone", async () => {
    const onDone = vi.fn();
    render(
      <RevokeNodeScepChallengeDialog
        challengeId="ch-1"
        nodeName="acme-edge-07"
        onClose={vi.fn()}
        onDone={onDone}
        profile="network-device"
      />,
    );
    fireEvent.click(revokeButton());

    await waitFor(() =>
      expect(revokeNodeScepChallenge).toHaveBeenCalledWith("acme-edge-07", "ch-1"),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("surfaces a server-side refusal inline", async () => {
    revokeNodeScepChallenge.mockRejectedValue(new Error("no challenge with that id"));
    renderDialog();
    fireEvent.click(revokeButton());
    await waitFor(() => expect(screen.getByText(/no challenge with that id/i)).toBeInTheDocument());
  });
});
