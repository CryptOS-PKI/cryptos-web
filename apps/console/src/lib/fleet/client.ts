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

import { type Interceptor, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { FleetService } from "@cryptos-pki/api-client/cryptos/fleet/v1/fleet_pb";

import { errorCode, errorReason } from "@/lib/fleet/error-code";
import { reportApiError } from "@/lib/fleet/error-reporter";

// Reports every refusal to error-reporter's listeners, then rethrows
// unchanged: callers still see exactly the error they would without this.
const reportErrors: Interceptor = (next) => async (req) => {
  try {
    return await next(req);
  } catch (error) {
    reportApiError({ code: errorCode(error), reason: errorReason(error) });
    throw error;
  }
};

// A single Connect client for the manager's FleetService, used by every live
// surface's data hook. `VITE_FLEET_API` points at the manager; unset falls
// back to the manager's default local dev port. Auth (live-auth) attaches the
// gateway session on top of this same transport once that lands -- roadmap.
export const fleetClient = () =>
  createClient(
    FleetService,
    createConnectTransport({
      baseUrl: import.meta.env.VITE_FLEET_API ?? "http://localhost:8080",
      fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
      interceptors: [reportErrors],
    }),
  );
