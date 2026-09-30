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

import { Code, ConnectError } from "@connectrpc/connect";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/context/auth";

const whoAmI = vi.fn();
const fleetMode = vi.fn(() => "live");
// The reachability probe goes through fetch rather than the Connect client, so
// it can answer without a client certificate.
const probe = vi.fn();
vi.mock("@/lib/fleet/client", () => ({ fleetClient: () => ({ whoAmI }) }));
vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => fleetMode() }));

const Probe = () => {
  const { login, operator, reason, status } = useAuth();
  return (
    <div>
      <span data-testid="state">
        {status}:{operator?.level ?? "none"}:{reason ?? "none"}
      </span>
      <button onClick={login} type="button">
        sign in
      </button>
    </div>
  );
};

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

const state = () => screen.getByTestId("state").textContent;

describe("AuthProvider", () => {
  beforeEach(() => {
    whoAmI.mockReset();
    probe.mockReset();
    fleetMode.mockReturnValue("live");
    vi.stubGlobal("fetch", probe);
  });

  // The point of #68: arriving at the page must not sign you in, even holding a
  // valid certificate. Nothing is asked of the API until Login is clicked.
  it("starts anonymous without calling WhoAmI", () => {
    renderProbe();

    expect(state()).toBe("anonymous:none:none");
    expect(whoAmI).not.toHaveBeenCalled();
  });

  it("populates operator and level from WhoAmI on login", async () => {
    whoAmI.mockResolvedValue({
      operator: { cn: "op@acme.example", level: "admin", serial: "0A:BC" },
    });
    renderProbe();

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("authenticated:admin:none"));
    expect(whoAmI).toHaveBeenCalledTimes(1);
  });

  // An unknown level must not inherit privilege it was not granted.
  it("treats an unrecognised level as viewer", async () => {
    whoAmI.mockResolvedValue({
      operator: { cn: "op@acme.example", level: "wizard", serial: "0A:BC" },
    });
    renderProbe();

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("authenticated:viewer:none"));
  });

  it("goes denied when WhoAmI returns no operator", async () => {
    whoAmI.mockResolvedValue({ operator: undefined });
    renderProbe();

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("denied:none:not-authorized"));
  });

  // 401 from the manager means the connection completed its handshake without a
  // client certificate. That is usually a connection opened for the anonymous
  // page and reused for the API (manager#77), which the manager now closes when
  // it refuses the call, so one retry gets a fresh handshake where the browser
  // can offer the certificate it holds.
  it("retries once after a 401 and signs in on the fresh connection", async () => {
    whoAmI.mockRejectedValueOnce(new ConnectError("no cert", Code.Unauthenticated));
    whoAmI.mockResolvedValueOnce({
      operator: { cn: "op@acme.example", level: "admin", serial: "0A:BC" },
    });
    renderProbe();

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("authenticated:admin:none"));
    expect(whoAmI).toHaveBeenCalledTimes(2);
  });

  // Refused again on a fresh handshake: the browser completed a connection and
  // chose not to send a certificate. That is not the same failure as an
  // aborted handshake (Unknown), and it gets its own advice.
  it("reports a certificate that was not sent when the retry is refused too", async () => {
    whoAmI.mockRejectedValue(new ConnectError("no cert", Code.Unauthenticated));
    renderProbe();

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("denied:none:certificate-not-sent"));
    expect(whoAmI).toHaveBeenCalledTimes(2);
  });

  // Only a 401 is worth a second handshake; a presented certificate the fleet
  // refuses will be refused again.
  it("does not retry a permission denial", async () => {
    whoAmI.mockRejectedValue(new ConnectError("no level", Code.PermissionDenied));
    renderProbe();

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("denied:none:not-authorized"));
    expect(whoAmI).toHaveBeenCalledTimes(1);
  });

  it("reports an unauthorized certificate when the API answers permission denied", async () => {
    whoAmI.mockRejectedValue(new ConnectError("no level", Code.PermissionDenied));
    renderProbe();

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("denied:none:not-authorized"));
  });

  // A server that answers Unavailable is a genuine outage.
  it("reports unavailable when the API answers unavailable", async () => {
    whoAmI.mockRejectedValue(new ConnectError("down", Code.Unavailable));
    renderProbe();

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("denied:none:unavailable"));
  });

  // The case from the field: a browser with no usable certificate, or an
  // operator who cancels Chrome's certificate prompt, aborts the connection.
  // fetch rejects with a TypeError, which Connect reports as Unknown. Since the
  // page the operator is reading was served anonymously by the same origin, a
  // reachable web surface means the service is up and the certificate is the
  // problem -- reporting an outage sends them to debug the wrong thing (#81).
  it("reports a missing certificate when the transport fails but the site is reachable", async () => {
    whoAmI.mockRejectedValue(new ConnectError("Failed to fetch", Code.Unknown));
    probe.mockResolvedValue({ ok: true } as Response);
    renderProbe();

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("denied:none:no-certificate"));
    expect(probe).toHaveBeenCalled();
  });

  it("reports unavailable when the transport fails and the site is gone too", async () => {
    whoAmI.mockRejectedValue(new ConnectError("Failed to fetch", Code.Unknown));
    probe.mockRejectedValue(new TypeError("Failed to fetch"));
    renderProbe();

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("denied:none:unavailable"));
  });

  // A reachability probe that answers with an error status is not a working
  // site, so it must not be read as one.
  it("reports unavailable when the reachability probe returns an error status", async () => {
    whoAmI.mockRejectedValue(new ConnectError("Failed to fetch", Code.Unknown));
    probe.mockResolvedValue({ ok: false } as Response);
    renderProbe();

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("denied:none:unavailable"));
  });

  it("can be retried after a denial", async () => {
    whoAmI.mockRejectedValueOnce(new ConnectError("no cert", Code.Unauthenticated));
    whoAmI.mockRejectedValueOnce(new ConnectError("no cert", Code.Unauthenticated));
    whoAmI.mockResolvedValueOnce({
      operator: { cn: "op@acme.example", level: "operator", serial: "0A:BC" },
    });
    renderProbe();
    const button = screen.getByRole("button", { name: /sign in/i });

    button.click();
    await waitFor(() => expect(state()).toBe("denied:none:certificate-not-sent"));

    button.click();
    await waitFor(() => expect(state()).toBe("authenticated:operator:none"));
  });

  // Mock mode has no browser certificate to present, but it must still go
  // through the same explicit login rather than short-circuiting to signed in.
  it("still requires an explicit login in mock mode", async () => {
    fleetMode.mockReturnValue("mock");
    renderProbe();

    expect(state()).toBe("anonymous:none:none");

    screen.getByRole("button", { name: /sign in/i }).click();

    await waitFor(() => expect(state()).toBe("authenticated:admin:none"));
    expect(whoAmI).not.toHaveBeenCalled();
  });
});
