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

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";
import { refreshLiveNodes } from "@/lib/nodes";

// Remote decommission (S11). The manager dials the node over mTLS and invokes
// its admin-gated RemoteReset, which performs the same destructive wipe as the
// local Reset. The operator must echo the node's Root CA CN as confirmation;
// the node compares it constant-time and the manager audits the action. This
// module is the web-side trigger only -- the real authorization is server-side.

// decommissionNode wipes a managed node's identity and data by name, echoing
// its Root CA CN as the destructive confirmation. `mock` mode is a no-op that
// resolves so the flow is exercisable offline; live routes through the manager
// and surfaces its errors (a CN mismatch maps to PermissionDenied) to the
// caller with no silent fallback. On success the fleet is refetched so the
// node's move into maintenance shows without a reload.
export const decommissionNode = async (
  nodeName: string,
  confirmCommonName: string,
): Promise<void> => {
  if (!confirmCommonName.trim()) {
    throw new Error("Type the node's Root CA CN to confirm decommission.");
  }

  if (fleetMode() === "mock") {
    return;
  }

  await fleetClient().decommissionNode({ confirmCommonName, nodeName });
  await refreshLiveNodes();
};
