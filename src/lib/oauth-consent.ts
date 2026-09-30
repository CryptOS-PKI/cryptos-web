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

import type { DenialReason, OperatorLevel } from "@/context/auth";

import { webSurfaceReachable } from "@/context/auth";
import { fleetMode } from "@/lib/fleet/mode";

// The MCP sign-in consent round trip. These two endpoints are plain HTTP JSON on
// the manager's own origin rather than Connect RPCs: the manager's OAuth flow
// owns them, and the browser's client certificate is what authenticates the
// operator approving the request.

export interface ConsentRequest {
  allowedCeilings: OperatorLevel[];
  clientName: string;
  operator: { cn: string; level: OperatorLevel; serial: string };
  redirectHost: string;
}

export type ConsentLoad =
  | { kind: "denied"; reason: DenialReason }
  | { kind: "expired" }
  | { kind: "ready"; request: ConsentRequest };

export interface ConsentDecision {
  approve: boolean;
  label: string;
  levelCeiling: OperatorLevel;
}

export class ConsentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ConsentError";
  }
}

interface WireConsent {
  allowed_ceilings: string[];
  client_name: string;
  operator: { cn: string; level: string; serial: string };
  redirect_host: string;
}

const MOCK_REQUEST: ConsentRequest = {
  allowedCeilings: ["viewer", "operator", "admin"],
  clientName: "Example Agent",
  operator: { cn: "operator@example.org", level: "admin", serial: "3A:7F:0C:91:D2:44:8B:1E" },
  redirectHost: "127.0.0.1:53682",
};

const toLevel = (s: string): OperatorLevel => (s === "admin" || s === "operator" ? s : "viewer");

const consentUrl = (id: string): string => `/oauth2/consent/${encodeURIComponent(id)}`;

const getConsent = (id: string): Promise<Response> =>
  fetch(consentUrl(id), {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

// The SPA may have been served on a connection that carried no certificate, and
// HTTP/2 reuses it for this request, which the manager refuses and closes. One
// retry gets a new handshake where the browser can offer the certificate it
// holds, the same as the WhoAmI login path.
const getConsentOnFreshConnection = async (id: string): Promise<Response> => {
  const first = await getConsent(id);
  return first.status === 401 ? getConsent(id) : first;
};

export const loadConsent = async (id: string): Promise<ConsentLoad> => {
  if (fleetMode() === "mock") {
    return { kind: "ready", request: MOCK_REQUEST };
  }

  let resp: Response;
  try {
    resp = await getConsentOnFreshConnection(id);
  } catch {
    // An aborted client-certificate handshake rejects fetch exactly like an
    // outage, so ask the anonymous origin which one it was.
    return {
      kind: "denied",
      reason: (await webSurfaceReachable()) ? "no-certificate" : "unavailable",
    };
  }

  switch (resp.status) {
    case 401: {
      return { kind: "denied", reason: "certificate-not-sent" };
    }
    case 403: {
      return { kind: "denied", reason: "not-authorized" };
    }
    case 404: {
      return { kind: "expired" };
    }
  }
  if (!resp.ok) {
    return { kind: "denied", reason: "unavailable" };
  }

  const body = (await resp.json()) as WireConsent;
  return {
    kind: "ready",
    request: {
      allowedCeilings: body.allowed_ceilings.map(toLevel),
      clientName: body.client_name,
      operator: {
        cn: body.operator.cn,
        level: toLevel(body.operator.level),
        serial: body.operator.serial,
      },
      redirectHost: body.redirect_host,
    },
  };
};

// decideConsent records the operator's answer and returns where the manager
// wants the browser to go next: the MCP client's loopback redirect, carrying
// either the one-time code or the denial.
export const decideConsent = async (id: string, decision: ConsentDecision): Promise<string> => {
  if (fleetMode() === "mock") {
    return decision.approve
      ? `http://${MOCK_REQUEST.redirectHost}/callback?code=mock`
      : `http://${MOCK_REQUEST.redirectHost}/callback?error=access_denied`;
  }

  const resp = await fetch(consentUrl(id), {
    body: JSON.stringify({
      approve: decision.approve,
      label: decision.label,
      level_ceiling: decision.levelCeiling,
    }),
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    method: "POST",
  });

  if (resp.status === 404) {
    throw new ConsentError("This sign-in request has expired. Start the sign-in again.", 404);
  }
  if (!resp.ok) {
    throw new ConsentError(`The manager refused the decision (HTTP ${resp.status}).`, resp.status);
  }

  const body = (await resp.json()) as { redirect_to: string };
  return body.redirect_to;
};

export const leaveForClient = (url: string): void => {
  globalThis.location.assign(url);
};
