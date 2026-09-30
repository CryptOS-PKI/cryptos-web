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

import { refreshLiveCerts } from "@/lib/certs";
import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";
import { refreshLiveNodes } from "@/lib/nodes";

// The default CA profile the parent signs the re-keyed subordinate under when
// the wizard does not surface a profile picker.
export const DEFAULT_REKEY_PROFILE = "sub-ca";

// RekeyResult is the re-keyed identity the wizard renders on success: the
// node's own subject CN, the parent that signed it, and the new chain length.
export interface RekeyResult {
  chainLen: number;
  issuerCn: string;
  subjectCn: string;
}

// rekeyNode re-keys a subordinate CA through the manager's single orchestrated
// RekeyNode RPC: the manager runs the whole ferry (child mints a new key + CSR,
// the parent signs it, the child adopts the new chain) in one call, so the web
// makes no per-step calls of its own. After success it refetches the fleet and
// certificate sets unfiltered so the node's new identity and chain show up
// without a reload. `mock` mode has no live RPC to drive -- the wizard keeps
// its stepped demo there and never reaches here -- so calling this in mock mode
// is a clear error rather than a silent no-op.
export const rekeyNode = async (nodeName: string, profileName: string): Promise<RekeyResult> => {
  if (fleetMode() === "mock") {
    throw new Error("rekeyNode: live re-key requires live mode");
  }

  const response = await fleetClient().rekeyNode({ nodeName, profileName });

  // Refetch unfiltered: both refreshers replace the whole cache, so a
  // node-scoped refetch would transiently collapse the all-nodes/all-certs view.
  await refreshLiveNodes();
  await refreshLiveCerts();

  return {
    chainLen: response.chainLen,
    issuerCn: response.issuerCn,
    subjectCn: response.subjectCn,
  };
};
