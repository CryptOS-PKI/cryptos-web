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

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";
import { refreshLiveNodes } from "@/lib/nodes";

// Remote reboot (#61). A config change ApplyNodeConfig reported as
// requires_reboot, or any other change NodeSummary.reboot_required surfaces,
// only takes effect once the node reboots; this is how an operator triggers
// that from the web instead of power-cycling the node out of band. The
// manager dials the node over mTLS and invokes its admin-gated Reboot. The
// operator must echo the node's CA CN as confirmation; the node compares it
// constant-time and the manager audits the action. This module is the
// web-side trigger only -- the real authorization is server-side.

// rebootNode asks a managed node to reboot (or power off) by name, echoing
// its CA CN as the confirmation. `mock` mode is a no-op that resolves so the
// flow is exercisable offline; live routes through the manager and surfaces
// its errors (a CN mismatch maps to PermissionDenied) to the caller with no
// silent fallback. On success the fleet is refetched so the node's move
// through reboot shows without a reload.
export const rebootNode = async (
  nodeName: string,
  confirmCaCn: string,
  powerOff = false,
): Promise<void> => {
  if (!confirmCaCn.trim()) {
    throw new Error("Type the node's CA CN to confirm reboot.");
  }

  if (fleetMode() === "mock") {
    return;
  }

  await fleetClient().rebootNode({ confirmCaCn, nodeName, powerOff });
  await refreshLiveNodes();
};
