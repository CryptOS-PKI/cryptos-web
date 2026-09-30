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

import { Code, ConnectError } from "@connectrpc/connect";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// Auth-gate for browser-side mTLS. In production the operator authenticates
// with a smart-card / YubiKey-backed client certificate presented by the browser
// during the TLS handshake; there is no password login. The manager verifies the
// handshake and reports the operator's identity back through WhoAmI.
//
// Signing in is deliberately an explicit action (#68). Arriving at the page
// starts anonymous and asks the API nothing, even when the browser is holding a
// perfectly good certificate: the operator presses Log in, and that is what
// resolves their identity and access level. The page itself is reachable without
// a certificate, which is the only way someone who has none can be told so.
//
// Note the browser decides *when* to present a certificate -- that happens
// during the TLS handshake, before any of this runs -- so Log in checks the
// result of that handshake rather than triggering it. A dev browser cannot
// perform smart-card mTLS at all, so mock mode resolves a fixed operator
// identity, still behind the same explicit action.

export interface AuthState {
  /** Resolve the operator's identity and level from the presented certificate. */
  login: () => void;
  operator: null | Operator;
  reason: DenialReason | null;
  status: AuthStatus;
}

export type AuthStatus = "anonymous" | "authenticated" | "denied" | "presenting";

/**
 * Why a login attempt was refused. Each one sends the operator somewhere
 * different, so they are kept apart rather than collapsed into one failure.
 */
export type DenialReason =
  /**
   * A fresh handshake completed without a client certificate: the browser has
   * none to offer, or has remembered not to offer it to this site.
   */
  | "certificate-not-sent"
  /** The handshake carried no client certificate: none is installed. */
  | "no-certificate"
  /** A certificate was presented but the fleet will not accept it. */
  | "not-authorized"
  /** The manager could not be reached, which is not an authorization answer. */
  | "unavailable";

export interface Operator {
  /** Common name from the operator's client certificate subject. */
  commonName: string;
  /** Authorization level the manager assigned to this operator. */
  level: OperatorLevel;
  /** Certificate serial the manager verified during the mTLS handshake. */
  serial: string;
}

export type OperatorLevel = "admin" | "operator" | "viewer";

const AuthContext = createContext<AuthState | undefined>(undefined);

const DEV_OPERATOR: Operator = {
  commonName: "operator@acme.example",
  level: "admin",
  serial: "3A:7F:0C:91:D2:44:8B:1E",
};

const toLevel = (s: string): OperatorLevel => (s === "admin" || s === "operator" ? s : "viewer");

// webSurfaceReachable asks the origin for something that needs no client
// certificate. The manager serves the web surface anonymously, so a successful
// answer means the service is up and any failure on the API was the client's
// certificate rather than an outage.
export const webSurfaceReachable = async (): Promise<boolean> => {
  try {
    const resp = await fetch(`${globalThis.location.origin}/`, {
      cache: "no-store",
      method: "HEAD",
    });

    return resp.ok;
  } catch {
    return false;
  }
};

// The manager answers 401 when the handshake presented no certificate and 403
// when it presented one that is not an authorized operator, which Connect
// surfaces as these codes.
//
// A 401 reaches here only after whoAmIOnFreshConnection has already retried on
// a new connection, so it means a completed handshake in which the browser chose
// not to send a certificate. That is a different fix from an aborted handshake
// (Unknown), so it is reported separately (manager#77).
//
// Code.Unknown is the awkward one and the common one (#81). A browser holding no
// usable certificate -- or an operator who cancels the certificate prompt --
// aborts the connection with ERR_BAD_SSL_CLIENT_AUTH_CERT, fetch rejects with a
// TypeError, and Connect reports that as Unknown. It is indistinguishable from
// a dead service by the error alone, so ask the origin: the page in front of the
// operator was served anonymously, so if it answers, the service is up and the
// certificate is what is missing.
const toReason = async (err: unknown): Promise<DenialReason> => {
  switch (ConnectError.from(err).code) {
    case Code.PermissionDenied: {
      return "not-authorized";
    }
    case Code.Unauthenticated: {
      return "certificate-not-sent";
    }
    case Code.Unknown: {
      return (await webSurfaceReachable()) ? "no-certificate" : "unavailable";
    }
    default: {
      return "unavailable";
    }
  }
};

// whoAmIOnFreshConnection retries WhoAmI once after a 401. The page load opens a
// connection without needing a certificate, and HTTP/2 reuses it for the API,
// which then refuses it (manager#77). The manager closes a connection it
// refuses for that reason, so the retry performs a new handshake where the
// browser can offer the certificate it holds. Any other failure is final.
const whoAmIOnFreshConnection = async () => {
  try {
    return await fleetClient().whoAmI({});
  } catch (error: unknown) {
    if (ConnectError.from(error).code !== Code.Unauthenticated) {
      throw error;
    }

    return fleetClient().whoAmI({});
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [operator, setOperator] = useState<null | Operator>(null);
  const [reason, setReason] = useState<DenialReason | null>(null);
  const [status, setStatus] = useState<AuthStatus>("anonymous");

  const login = useCallback(() => {
    setStatus("presenting");
    setReason(null);

    if (fleetMode() === "mock") {
      setOperator(DEV_OPERATOR);
      setStatus("authenticated");

      return;
    }

    void whoAmIOnFreshConnection()
      .then((resp) => {
        const op = resp.operator;
        if (!op) {
          // The manager withholds an identity for a certificate it verified but
          // will not accept as an operator.
          setOperator(null);
          setReason("not-authorized");
          setStatus("denied");

          return;
        }
        setOperator({ commonName: op.cn, level: toLevel(op.level), serial: op.serial });
        setStatus("authenticated");
      })
      .catch(async (error: unknown) => {
        const denial = await toReason(error);
        setOperator(null);
        setReason(denial);
        setStatus("denied");
      });
  }, []);

  return (
    <AuthContext.Provider value={{ login, operator, reason, status }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// useOptionalAuth reads the auth state without requiring a provider, returning
// null when there is none. Display components that embed in many contexts (the
// fleet list, the topology explorer, a standalone node view) use this to gate
// an admin-only action without forcing every render site to mount a provider.
export const useOptionalAuth = (): AuthState | null => useContext(AuthContext) ?? null;
