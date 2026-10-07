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

import { Code, ConnectError, createClient, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import {
  BootstrapService,
  BootstrapState,
} from "@cryptos-pki/api-client/cryptos/fleet/v1/bootstrap_pb";
import { ErrorReason } from "@cryptos-pki/api-client/cryptos/fleet/v1/errors_pb";
import { reportApiErrors } from "@/lib/fleet/error-reporter";
import { fleetMode } from "@/lib/fleet/mode";
import { normalizeFingerprint } from "@/lib/fingerprint";
import {
  mockPreview,
  mockProbe,
  type RegisterForm,
  type RegisterResult,
  registerRequestFields,
  toRegisterResult,
} from "@/lib/operator-cas";
import { levelExtfileSection } from "@/lib/operators";

// The first-run (day-zero) client. BootstrapService runs outside the
// certificate gate: GetBootstrapState is anonymous, StartBootstrapSession
// takes the token from the manager's log, and the other two calls carry the
// session secret in the Fleetos-Bootstrap-Session header. The secret lives
// only in this module's memory: never a cookie, never web storage, never a
// URL. A reload loses it, and the operator starts again with the newest token.

export const BOOTSTRAP_SESSION_HEADER = "Fleetos-Bootstrap-Session";

let sessionSecret: null | string = null;

const sessionHeader: Interceptor = (next) => (request) => {
  if (sessionSecret !== null) request.header.set(BOOTSTRAP_SESSION_HEADER, sessionSecret);
  return next(request);
};

const bootstrapClient = () =>
  createClient(
    BootstrapService,
    createConnectTransport({
      baseUrl: import.meta.env.VITE_FLEET_API ?? "http://localhost:8080",
      interceptors: [sessionHeader, reportApiErrors],
    }),
  );

export interface BootstrapStatus {
  reasonCode: ErrorReason;
  state: BootstrapState;
  tokenExpiresAt: string;
}

export interface FirstAdminResult {
  email: string;
  issuerSha256: string;
  notAfter: string;
  serialHex: string;
  warnings: string[];
}

// Mock mode stays closed unless a test (or VITE_BOOTSTRAP_MOCK_STATE=open for
// offline UI work) opens it, so the mock console behaves as before.
const initialMockState = (): BootstrapState =>
  import.meta.env.VITE_BOOTSTRAP_MOCK_STATE === "open"
    ? BootstrapState.OPEN
    : BootstrapState.CLOSED;
let mockState = initialMockState();
let mockRegistered: null | RegisterResult = null;

export const getBootstrapState = async (): Promise<BootstrapStatus> => {
  if (fleetMode() === "mock") {
    return { reasonCode: ErrorReason.UNSPECIFIED, state: mockState, tokenExpiresAt: "" };
  }
  const response = await bootstrapClient().getBootstrapState({});
  return {
    reasonCode: response.reasonCode,
    state: response.state,
    tokenExpiresAt: response.tokenExpiresAt,
  };
};

export const hasBootstrapSession = (): boolean => sessionSecret !== null;

export const endBootstrapSession = (): void => {
  sessionSecret = null;
};

// startBootstrapSession trades the bootstrap token for a session. The token is
// single use: the manager prints a new one at once.
export const startBootstrapSession = async (token: string): Promise<{ expiresAt: string }> => {
  if (fleetMode() === "mock") {
    if (!token.trim().startsWith("fos_boot_")) {
      throw new ConnectError("token invalid", Code.Unauthenticated, {
        "x-cryptos-error-code": "1600",
      });
    }
    sessionSecret = "fos_bsess_mock";
    mockState = BootstrapState.OPEN_IN_PROGRESS;
    return { expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
  }
  const response = await bootstrapClient().startBootstrapSession({ token: token.trim() });
  sessionSecret = response.sessionSecret;
  return { expiresAt: response.expiresAt };
};

export const registerOperatorCABootstrap = async (form: RegisterForm): Promise<RegisterResult> => {
  if (fleetMode() === "mock") {
    if (form.caCertDer.length === 0) {
      if (!mockRegistered) {
        throw new ConnectError("no registration", Code.FailedPrecondition, {
          "x-cryptos-error-code": "1605",
          "x-cryptos-error-reason": "NOT_CONFIRMED",
        });
      }
      return {
        ...mockRegistered,
        confirmed: normalizeFingerprint(form.confirmSha256) === mockRegistered.operatorCa.sha256,
      };
    }
    const preview: RegisterResult = {
      adminExtfile: levelExtfileSection("admin"),
      confirmed: false,
      ocspProbe: mockProbe(form.ocspMode),
      operatorCa: await mockPreview(form),
    };
    if (form.confirmSha256 === "") return preview;
    if (normalizeFingerprint(form.confirmSha256) !== preview.operatorCa.sha256) {
      throw new ConnectError("not confirmed", Code.FailedPrecondition, {
        "x-cryptos-error-code": "1605",
        "x-cryptos-error-reason": "NOT_CONFIRMED",
      });
    }
    mockRegistered = { ...preview, confirmed: true };
    return mockRegistered;
  }
  return toRegisterResult(await bootstrapClient().registerOperatorCA(registerRequestFields(form)));
};

// submitFirstAdminCertificate records the first admin's certificate, which
// the operator CA signed. With the CSR, the manager also checks the key
// matches; without it this is path B's pre-flight. The key never goes here.
export const submitFirstAdminCertificate = async (params: {
  certDer: Uint8Array;
  csrDer?: Uint8Array;
  fullName: string;
}): Promise<FirstAdminResult> => {
  if (fleetMode() === "mock") {
    return {
      email: "admin@example.org",
      issuerSha256: mockRegistered?.operatorCa.sha256 ?? "",
      notAfter: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      serialHex: "4F:00:A1",
      warnings: [],
    };
  }
  const response = await bootstrapClient().submitFirstAdminCertificate({
    certDer: new Uint8Array(params.certDer),
    csrDer: new Uint8Array(params.csrDer ?? []),
    fullName: params.fullName.trim(),
  });
  return {
    email: response.email,
    issuerSha256: response.issuerSha256,
    notAfter: response.notAfter,
    serialHex: response.serialHex,
    warnings: [...response.warnings],
  };
};

// Test-only: forget the session and reset the mock state.
export const __resetBootstrap = (): void => {
  sessionSecret = null;
  mockState = initialMockState();
  mockRegistered = null;
};

export const __setMockBootstrapState = (state: BootstrapState): void => {
  mockState = state;
};
