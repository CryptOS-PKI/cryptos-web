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

import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { FleetService } from "@/gen/fleet/cryptos/fleet/v1/fleet_pb";

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
    }),
  );
