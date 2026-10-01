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

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { App } from "@/App";
import { AuthProvider } from "@/context/auth";

const renderAt = (path: string) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthProvider>,
  );

describe("App routing", () => {
  // The MCP client opens the consent page straight from its sign-in; the
  // request is authenticated by the certificate the browser presents, so the
  // console's Log in step must not stand in front of it.
  it("serves the MCP consent page without logging in first", async () => {
    renderAt("/oauth/consent?req=req-1");

    expect(await screen.findByText(/authorize an mcp client/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log in/i })).not.toBeInTheDocument();
  });

  // Someone without a credential yet makes their key and CSR here, so it can't
  // sit behind the gate that needs one.
  it("serves the credential request page without logging in first", () => {
    renderAt("/request-credential");

    expect(screen.getByRole("heading", { name: /make a credential request/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log in/i })).not.toBeInTheDocument();
  });

  // The gate asks the Fleet Manager whether first run is open before it shows
  // the sign-in, so the Log in button appears once that answer is in.
  it("keeps the console behind the login gate", async () => {
    renderAt("/agent-keys");

    expect(await screen.findByRole("button", { name: /log in/i })).toBeInTheDocument();
  });
});
