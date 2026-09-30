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

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthState } from "@/context/auth";

import { AuthGate } from "@/components/layout/auth-gate";

const login = vi.fn();
let authState: AuthState;

vi.mock("@/context/auth", () => ({ useAuth: () => authState }));

// The copy action has its own tests, and it needs a router and the optional
// auth hook; stubbing it keeps this test on the gate's own behaviour.
vi.mock("@/components/layout/diagnostics-copy", () => ({
  DiagnosticsCopy: () => null,
}));

const renderGate = () =>
  render(
    <AuthGate>
      <div>fleet console</div>
    </AuthGate>,
  );

describe("AuthGate", () => {
  beforeEach(() => {
    login.mockReset();
    authState = { login, operator: null, reason: null, status: "anonymous" };
  });

  // The landing page has to be usable by someone who has no certificate at all:
  // it is the only thing they can reach, and it is how they learn what to do.
  it("offers a login action and withholds the console when anonymous", () => {
    renderGate();

    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
    expect(screen.queryByText("fleet console")).not.toBeInTheDocument();
  });

  it("calls login when the button is clicked", () => {
    renderGate();

    screen.getByRole("button", { name: /log in/i }).click();

    expect(login).toHaveBeenCalledTimes(1);
  });

  it("shows progress while the certificate is being checked", () => {
    authState = { login, operator: null, reason: null, status: "presenting" };
    renderGate();

    expect(screen.getByText(/checking/i)).toBeInTheDocument();
    expect(screen.queryByText("fleet console")).not.toBeInTheDocument();
  });

  it("renders the console once authenticated", () => {
    authState = {
      login,
      operator: { commonName: "op@acme.example", level: "admin", serial: "0A:BC" },
      reason: null,
      status: "authenticated",
    };
    renderGate();

    expect(screen.getByText("fleet console")).toBeInTheDocument();
  });

  // Each denial reason sends the operator somewhere different, so they must not
  // share one message. Telling someone to install a certificate when the
  // manager is simply unreachable wastes their time.
  it.each([
    ["no-certificate" as const, /^No operator certificate$/],
    ["certificate-not-sent" as const, /^Certificate not sent$/],
    ["not-authorized" as const, /certificate not authori[sz]ed/i],
    ["unavailable" as const, /could not be reached/i],
  ])("explains the %s denial", (reason, expected) => {
    authState = { login, operator: null, reason, status: "denied" };
    renderGate();

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText("fleet console")).not.toBeInTheDocument();
  });

  // The no-certificate case is the one an operator can act on, so it carries the
  // install instructions; an outage is not their problem to fix (#81).
  it("shows install instructions when no certificate was presented", () => {
    authState = { login, operator: null, reason: "no-certificate", status: "denied" };
    renderGate();

    expect(screen.getByRole("heading", { name: /windows/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /firefox/i })).toBeInTheDocument();
  });

  // A browser that connected without sending a certificate may have none, or may
  // have remembered not to send it; the page says how to clear that and still
  // carries the install instructions for the first case (manager#77).
  it("explains how to clear a remembered refusal when no certificate was sent", () => {
    authState = { login, operator: null, reason: "certificate-not-sent", status: "denied" };
    renderGate();

    expect(screen.getByText(/restart the browser/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /windows/i })).toBeInTheDocument();
  });

  it("does not offer install instructions for an outage", () => {
    authState = { login, operator: null, reason: "unavailable", status: "denied" };
    renderGate();

    expect(screen.queryByRole("heading", { name: /windows/i })).not.toBeInTheDocument();
  });

  it("lets a denied operator try again", () => {
    authState = { login, operator: null, reason: "no-certificate", status: "denied" };
    renderGate();

    screen.getByRole("button", { name: /try again/i }).click();

    expect(login).toHaveBeenCalledTimes(1);
  });
});
