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

import { CaStep } from "@/components/first-run/ca-step";
import { colonFingerprint } from "@/lib/fingerprint";
import { type RegisterResult, toCARow } from "@/lib/operator-cas";
import { expectNoA11yViolations } from "@/test/axe";

const registerOperatorCABootstrap = vi.fn();
vi.mock("@/lib/bootstrap", () => ({
  registerOperatorCABootstrap: (...args: unknown[]) => registerOperatorCABootstrap(...args),
}));

const SHA = "3c".repeat(32);
const OTHER_SHA = "00".repeat(32);

// A session that opens on a CA already registered by an earlier run (or
// someone else, with a leaked token): CaStep must reconfirm it rather than
// trust it silently.
const registered = (confirmed = false): RegisterResult => ({
  adminExtfile: "[ op_admin ]",
  confirmed,
  ocspProbe: undefined,
  operatorCa: toCARow({
    issuer: "CN=Example Operator CA",
    sha256: SHA,
    subject: "CN=Example Operator CA",
  }),
});

const openReconfirm = async () => {
  registerOperatorCABootstrap.mockResolvedValueOnce(registered());
  render(<CaStep inProgress onRegistered={vi.fn()} />);
  return screen.findByText(/already registered/i);
};

beforeEach(() => {
  registerOperatorCABootstrap.mockReset();
});

describe("CaStep reconfirm path", () => {
  it("has no axe violations while confirming an already-registered CA", async () => {
    registerOperatorCABootstrap.mockResolvedValueOnce(registered());
    const { container } = render(<CaStep inProgress onRegistered={vi.fn()} />);
    await screen.findByText(/already registered/i);
    await expectNoA11yViolations(container);
  });

  it("shows the already-registered CA's fingerprint, with Confirm disabled until it's pasted", async () => {
    await openReconfirm();
    expect(screen.getByText("CN=Example Operator CA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm this ca/i })).toBeDisabled();
  });

  it("confirming the right fingerprint continues and registers nothing new", async () => {
    const onRegistered = vi.fn();
    registerOperatorCABootstrap.mockResolvedValueOnce(registered());
    registerOperatorCABootstrap.mockResolvedValueOnce(registered(true));
    render(<CaStep inProgress onRegistered={onRegistered} />);
    await screen.findByText(/already registered/i);

    fireEvent.change(screen.getByLabelText(/paste the fingerprint/i), {
      target: { value: colonFingerprint(SHA) },
    });
    expect(screen.getByRole("button", { name: /confirm this ca/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /confirm this ca/i }));

    await waitFor(() => expect(onRegistered).toHaveBeenCalledTimes(1));
    const [result, anchorDer] = onRegistered.mock.calls[0] as [RegisterResult, null];
    expect(result.confirmed).toBe(true);
    expect(anchorDer).toBeNull();
    expect(registerOperatorCABootstrap).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirmSha256: SHA }),
    );
  });

  it("a mismatched fingerprint keeps Confirm disabled, says why, and registers nothing", async () => {
    const onRegistered = vi.fn();
    await openReconfirm();

    fireEvent.change(screen.getByLabelText(/paste the fingerprint/i), {
      target: { value: colonFingerprint(OTHER_SHA) },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/doesn't match/i);
    const confirm = screen.getByRole("button", { name: /confirm this ca/i });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);

    expect(onRegistered).not.toHaveBeenCalled();
    expect(registerOperatorCABootstrap).toHaveBeenCalledTimes(1);
  });

  it("Register a different CA cancels the reconfirm and registers nothing", async () => {
    const onRegistered = vi.fn();
    await openReconfirm();

    fireEvent.click(screen.getByRole("button", { name: /register a different ca/i }));

    expect(screen.getByLabelText(/operator ca certificate/i)).toBeInTheDocument();
    expect(screen.queryByText(/already registered/i)).not.toBeInTheDocument();
    expect(onRegistered).not.toHaveBeenCalled();
    expect(registerOperatorCABootstrap).toHaveBeenCalledTimes(1);
  });

  it("surfaces a refused reconfirm inline and does not advance", async () => {
    const onRegistered = vi.fn();
    registerOperatorCABootstrap.mockResolvedValueOnce(registered());
    registerOperatorCABootstrap.mockRejectedValueOnce(new Error("confirm refused"));
    render(<CaStep inProgress onRegistered={onRegistered} />);
    await screen.findByText(/already registered/i);

    fireEvent.change(screen.getByLabelText(/paste the fingerprint/i), {
      target: { value: colonFingerprint(SHA) },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirm this ca/i }));

    expect(await screen.findByText(/confirm refused/i)).toBeInTheDocument();
    expect(onRegistered).not.toHaveBeenCalled();
  });
});
