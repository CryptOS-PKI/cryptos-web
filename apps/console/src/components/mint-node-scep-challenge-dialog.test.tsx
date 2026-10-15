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

import { MintNodeScepChallengeDialog } from "@/components/mint-node-scep-challenge-dialog";
import { expectNoA11yViolations } from "@/test/axe";

const mintNodeScepChallenge = vi.fn();
vi.mock("@/lib/node-scep-challenges", () => ({
  mintNodeScepChallenge: (...a: unknown[]) => mintNodeScepChallenge(...a),
}));

const mintButton = () => screen.getByRole("button", { name: /^mint challenge$/i });

const renderDialog = () =>
  render(
    <MintNodeScepChallengeDialog nodeName="acme-edge-07" onClose={vi.fn()} onMinted={vi.fn()} />,
  );

describe("MintNodeScepChallengeDialog", () => {
  beforeEach(() => {
    mintNodeScepChallenge.mockReset();
    mintNodeScepChallenge.mockResolvedValue({
      challenge: {
        boundNames: [],
        createdAt: "",
        createdByCn: "",
        expiresAt: "",
        id: "ch-1",
        profile: "network-device",
      },
      challengePassword: "one-time-password-123",
    });
  });

  it("has no axe violations before minting", async () => {
    renderDialog();
    await expectNoA11yViolations(document.body);
  });

  it("mints with the entered profile, ttl and bound names, then shows the password once", async () => {
    const onMinted = vi.fn();
    render(
      <MintNodeScepChallengeDialog nodeName="acme-edge-07" onClose={vi.fn()} onMinted={onMinted} />,
    );

    fireEvent.change(screen.getByLabelText(/^profile$/i), { target: { value: "network-device" } });
    fireEvent.change(screen.getByLabelText(/ttl/i), { target: { value: "7200" } });
    fireEvent.change(screen.getByLabelText(/bound names/i), {
      target: { value: "switch-1.example.org, 10.0.0.5" },
    });
    fireEvent.click(mintButton());

    await waitFor(() =>
      expect(mintNodeScepChallenge).toHaveBeenCalledWith("acme-edge-07", {
        boundNames: ["switch-1.example.org", "10.0.0.5"],
        profile: "network-device",
        ttlSeconds: 7200,
      }),
    );
    expect(await screen.findByText("one-time-password-123")).toBeInTheDocument();
    expect(onMinted).toHaveBeenCalled();
  });

  it("has no axe violations after minting (shown-once secret)", async () => {
    renderDialog();
    fireEvent.click(mintButton());
    await screen.findByText("one-time-password-123");
    await expectNoA11yViolations(document.body);
  });

  it("surfaces a server-side refusal inline", async () => {
    mintNodeScepChallenge.mockRejectedValue(new Error('node has no profile named "bogus"'));
    renderDialog();
    fireEvent.click(mintButton());
    await waitFor(() => expect(screen.getByText(/no profile named/i)).toBeInTheDocument());
  });
});
