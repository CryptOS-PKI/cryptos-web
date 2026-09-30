/*
Apache License 2.0

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
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OAuthConsentPage } from "@/pages/oauth-consent";

const leaveForClient = vi.fn();
vi.mock("@/lib/fleet/mode", () => ({ fleetMode: () => "live" }));
vi.mock("@/lib/oauth-consent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/oauth-consent")>()),
  leaveForClient: (url: string) => leaveForClient(url),
}));

const request = {
  allowed_ceilings: ["viewer", "operator"],
  client_name: "Example Agent",
  operator: { cn: "operator@example.org", level: "operator", serial: "0A:BC:DE" },
  redirect_host: "127.0.0.1:53682",
};

const json = (status: number, body: unknown = {}) => ({
  json: async () => body,
  ok: status >= 200 && status < 300,
  status,
});

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/oauth/consent${search}`]}>
      <Routes>
        <Route element={<OAuthConsentPage />} path="/oauth/consent" />
      </Routes>
    </MemoryRouter>,
  );

describe("OAuthConsentPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    leaveForClient.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("shows the client, where it redirects, and who is approving", async () => {
    fetchMock.mockResolvedValueOnce(json(200, request));
    renderAt("?req=req-1");

    expect(await screen.findByText("Example Agent")).toBeInTheDocument();
    expect(screen.getByText("127.0.0.1:53682")).toBeInTheDocument();
    expect(screen.getByText("operator@example.org")).toBeInTheDocument();
    expect(screen.getByText("0A:BC:DE")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/oauth2/consent/req-1", expect.anything());
  });

  it("offers only the allowed ceilings and defaults to the operator's level", async () => {
    fetchMock.mockResolvedValueOnce(json(200, request));
    renderAt("?req=req-1");

    const ceiling = await screen.findByLabelText(/level ceiling/i);
    expect(ceiling).toHaveValue("operator");
    const options = [...(ceiling as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toEqual(["viewer", "operator"]);
  });

  it("posts an approval with the label and ceiling, then returns to the client", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, request))
      .mockResolvedValueOnce(json(200, { redirect_to: "http://127.0.0.1:53682/cb?code=c1" }));
    renderAt("?req=req-1");

    fireEvent.change(await screen.findByLabelText(/level ceiling/i), {
      target: { value: "viewer" },
    });
    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: "laptop agent" } });
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() =>
      expect(leaveForClient).toHaveBeenCalledWith("http://127.0.0.1:53682/cb?code=c1"),
    );
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/oauth2/consent/req-1");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      approve: true,
      label: "laptop agent",
      level_ceiling: "viewer",
    });
  });

  it("posts a denial and still returns to the client", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, request))
      .mockResolvedValueOnce(json(200, { redirect_to: "http://127.0.0.1:53682/cb?error=x" }));
    renderAt("?req=req-1");

    fireEvent.click(await screen.findByRole("button", { name: /deny/i }));

    await waitFor(() =>
      expect(leaveForClient).toHaveBeenCalledWith("http://127.0.0.1:53682/cb?error=x"),
    );
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ approve: false });
  });

  it("says the request expired on a 404", async () => {
    fetchMock.mockResolvedValueOnce(json(404));
    renderAt("?req=gone");

    expect(await screen.findByText(/expired or unknown/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("retries a 401 on a fresh connection, then shows the missing-certificate help", async () => {
    fetchMock.mockResolvedValue(json(401));
    renderAt("?req=req-1");

    expect(await screen.findByText("Certificate not sent")).toBeInTheDocument();
    expect(screen.getByText(/Firefox keeps its own certificate store/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("says the certificate is not authorized on a 403", async () => {
    fetchMock.mockResolvedValueOnce(json(403));
    renderAt("?req=req-1");

    expect(await screen.findByText("Certificate not authorized")).toBeInTheDocument();
  });

  it("asks nothing of the manager without a request id", async () => {
    renderAt("");

    expect(await screen.findByText(/no sign-in request/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
