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

import { BootstrapState } from "@cryptos-pki/api-client/cryptos/fleet/v1/bootstrap_pb";
import { ErrorReason } from "@cryptos-pki/api-client/cryptos/fleet/v1/errors_pb";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BootstrapGate } from "@/components/layout/bootstrap-gate";

const auth = vi.hoisted(() => ({
  login: vi.fn(),
  state: { status: "anonymous" } as { status: string },
}));
vi.mock("@/context/auth", () => ({
  useAuth: () => ({ login: auth.login, operator: null, reason: null, status: auth.state.status }),
}));

const getBootstrapState = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bootstrap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bootstrap")>()),
  getBootstrapState,
}));

const wizard = vi.hoisted(() => vi.fn());
vi.mock("@/components/first-run/first-run-wizard", () => ({
  FirstRunWizard: (props: unknown) => {
    wizard(props);
    return <p>first-run wizard</p>;
  },
}));
vi.mock("@/components/layout/diagnostics-copy", () => ({ DiagnosticsCopy: () => null }));

const status = (state: BootstrapState, reasonCode = ErrorReason.UNSPECIFIED) => ({
  reasonCode,
  state,
  tokenExpiresAt: "2026-09-30T13:00:00Z",
});

const renderGate = () =>
  render(
    <BootstrapGate>
      <p>auth gate</p>
    </BootstrapGate>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  auth.state.status = "anonymous";
});

describe("BootstrapGate", () => {
  it.each([BootstrapState.CLOSED, BootstrapState.NOT_APPLICABLE, BootstrapState.UNSPECIFIED])(
    "hands state %i to the normal sign-in without asking WhoAmI",
    async (state) => {
      getBootstrapState.mockResolvedValue(status(state));
      renderGate();
      await screen.findByText("auth gate");
      expect(auth.login).not.toHaveBeenCalled();
      expect(screen.queryByText("first-run wizard")).not.toBeInTheDocument();
    },
  );

  it("asks the bootstrap state before anything else", () => {
    getBootstrapState.mockReturnValue(new Promise(() => {}));
    renderGate();
    expect(screen.queryByText("auth gate")).not.toBeInTheDocument();
    expect(screen.getByText(/checking the fleet manager/i)).toBeInTheDocument();
  });

  it("falls back to sign-in when the manager has no first run to report", async () => {
    getBootstrapState.mockRejectedValue(new Error("unimplemented"));
    renderGate();
    await screen.findByText("auth gate");
  });

  it("explains why first run is unavailable, then offers sign-in", async () => {
    getBootstrapState.mockResolvedValue(
      status(BootstrapState.UNAVAILABLE, ErrorReason.DATABASE_REQUIRED),
    );
    renderGate();
    await screen.findByText("auth gate");
    expect(screen.getByRole("note")).toHaveTextContent(/Postgres/);
  });

  it.each([BootstrapState.OPEN, BootstrapState.OPEN_IN_PROGRESS])(
    "with state %i tries WhoAmI and opens the console when an admin certificate is presented",
    async (state) => {
      getBootstrapState.mockResolvedValue(status(state));
      const view = renderGate();
      await waitFor(() => expect(auth.login).toHaveBeenCalledTimes(1));
      auth.state.status = "authenticated";
      view.rerender(
        <BootstrapGate>
          <p>auth gate</p>
        </BootstrapGate>,
      );
      await screen.findByText("auth gate");
      expect(screen.queryByText("first-run wizard")).not.toBeInTheDocument();
    },
  );

  it.each([BootstrapState.OPEN, BootstrapState.OPEN_IN_PROGRESS])(
    "with state %i shows the first-run wizard when WhoAmI fails",
    async (state) => {
      getBootstrapState.mockResolvedValue(status(state));
      const view = renderGate();
      await waitFor(() => expect(auth.login).toHaveBeenCalled());
      auth.state.status = "denied";
      view.rerender(
        <BootstrapGate>
          <p>auth gate</p>
        </BootstrapGate>,
      );
      await screen.findByText("first-run wizard");
      expect(wizard).toHaveBeenLastCalledWith(
        expect.objectContaining({ inProgress: state === BootstrapState.OPEN_IN_PROGRESS }),
      );
      expect(screen.queryByText("auth gate")).not.toBeInTheDocument();
    },
  );
});
