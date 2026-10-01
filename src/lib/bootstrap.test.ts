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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BootstrapState } from "@/gen/fleet/cryptos/fleet/v1/bootstrap_pb";
import { ErrorReason } from "@/gen/fleet/cryptos/fleet/v1/errors_pb";
import {
  __resetBootstrap,
  BOOTSTRAP_SESSION_HEADER,
  endBootstrapSession,
  getBootstrapState,
  hasBootstrapSession,
  registerOperatorCABootstrap,
  startBootstrapSession,
  submitFirstAdminCertificate,
} from "@/lib/bootstrap";
import * as modeMod from "@/lib/fleet/mode";

const SECRET = "fos_bsess_" + "A".repeat(52);

interface Call {
  body: string;
  headers: Headers;
  url: string;
}

const stubManager = (responses: Record<string, unknown>) => {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const raw = init?.body;
      calls.push({
        body: ArrayBuffer.isView(raw) ? new TextDecoder().decode(raw) : String(raw ?? ""),
        headers: new Headers(init?.headers),
        url,
      });
      const method = url.split("/").pop() ?? "";
      return new Response(JSON.stringify(responses[method] ?? {}), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    }),
  );
  return calls;
};

beforeEach(() => {
  __resetBootstrap();
  vi.spyOn(modeMod, "fleetMode").mockReturnValue("live");
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("bootstrap client", () => {
  it("reads the state anonymously", async () => {
    const calls = stubManager({
      GetBootstrapState: {
        reasonCode: "ERROR_REASON_DATABASE_REQUIRED",
        state: "BOOTSTRAP_STATE_UNAVAILABLE",
      },
    });
    const state = await getBootstrapState();
    expect(state.state).toBe(BootstrapState.UNAVAILABLE);
    expect(state.reasonCode).toBe(ErrorReason.DATABASE_REQUIRED);
    expect(calls[0].url).toMatch(/cryptos\.fleet\.v1\.BootstrapService\/GetBootstrapState$/);
    expect(calls[0].headers.has(BOOTSTRAP_SESSION_HEADER)).toBe(false);
  });

  it("sends the session secret only in the header, and stores it nowhere", async () => {
    const calls = stubManager({
      RegisterOperatorCA: { confirmed: false, operatorCa: { sha256: "ab".repeat(32) } },
      StartBootstrapSession: { expiresAt: "2026-09-30T13:00:00Z", sessionSecret: SECRET },
      SubmitFirstAdminCertificate: { email: "admin@example.org", serialHex: "01" },
    });
    await startBootstrapSession("fos_boot_7K3Q-M2XD");
    expect(hasBootstrapSession()).toBe(true);

    await registerOperatorCABootstrap({
      caCertDer: new Uint8Array([1]),
      confirmSha256: "",
      crl: { kind: "none" },
      ocspMode: "aia",
      ocspUrl: "",
    });
    await submitFirstAdminCertificate({ certDer: new Uint8Array([2]), fullName: "Ada Admin" });

    expect(calls[0].headers.has(BOOTSTRAP_SESSION_HEADER)).toBe(false);
    for (const call of calls.slice(1)) {
      expect(call.headers.get(BOOTSTRAP_SESSION_HEADER)).toBe(SECRET);
      expect(call.body).not.toContain(SECRET);
      expect(call.url).not.toContain(SECRET);
    }
    const stored = [
      ...Object.values(localStorage),
      ...Object.values(sessionStorage),
      document.cookie,
    ].join("\n");
    expect(stored).not.toContain(SECRET);
    expect(stored).not.toContain("fos_boot_");
  });

  it("forgets the session when it ends", async () => {
    stubManager({ StartBootstrapSession: { sessionSecret: SECRET } });
    await startBootstrapSession("fos_boot_x");
    endBootstrapSession();
    expect(hasBootstrapSession()).toBe(false);
  });

  it("sends the CSR with the first admin certificate only when there is one", async () => {
    const calls = stubManager({
      StartBootstrapSession: { sessionSecret: SECRET },
      SubmitFirstAdminCertificate: { serialHex: "01" },
    });
    await startBootstrapSession("fos_boot_x");
    await submitFirstAdminCertificate({
      certDer: new Uint8Array([2]),
      csrDer: new Uint8Array([3]),
      fullName: "A",
    });
    expect(JSON.parse(calls[1].body)).toEqual({ certDer: "Ag==", csrDer: "Aw==", fullName: "A" });
  });
});

describe("bootstrap client (mock mode)", () => {
  it("starts closed, so the console behaves as before", async () => {
    vi.spyOn(modeMod, "fleetMode").mockReturnValue("mock");
    expect((await getBootstrapState()).state).toBe(BootstrapState.CLOSED);
  });
});
