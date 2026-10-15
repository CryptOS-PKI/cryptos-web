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

// NodeImageStatus describes the CryptOS images on a managed node's ESP and
// the one currently running (cryptosctl image status).
export interface NodeImageStatus {
  activeSha256: string;
  previousSha256: string;
  rebootPending: boolean;
  runningSha256: string;
  runningVersion: string;
}

const mockStatus: NodeImageStatus = {
  activeSha256: "7c3a9e2f1b6d48509d2b5c8e3f1a07241f4e8a7d2c9b0356deadbeef00112233",
  previousSha256: "1f4e8a7d2c9b03567c3a9e2f1b6d48509d2b5c8e3f1a0724deadbeef00445566",
  rebootPending: false,
  runningSha256: "7c3a9e2f1b6d48509d2b5c8e3f1a07241f4e8a7d2c9b0356deadbeef00112233",
  runningVersion: "0.1.0",
};

// getNodeImageStatus reads a managed node's CryptOS image status. Any
// operator may read it; mock mode returns a small canned status.
export const getNodeImageStatus = async (nodeName: string): Promise<NodeImageStatus> => {
  if (fleetMode() === "mock") {
    return mockStatus;
  }

  const response = await fleetClient().getNodeImageStatus({ nodeName });
  const status = response.status;
  return {
    activeSha256: status?.activeSha256 ?? "",
    previousSha256: status?.previousSha256 ?? "",
    rebootPending: status?.rebootPending ?? false,
    runningSha256: status?.runningSha256 ?? "",
    runningVersion: status?.runningVersion ?? "",
  };
};

export interface StageNodeImageInput {
  imageUrl: string;
  sha256: string;
  signature: Uint8Array;
}

// stageNodeImage installs a new CryptOS image on a managed node's spare ESP
// slot (cryptosctl image stage). The browser never carries the image: the
// manager fetches image_url itself. `mock` mode is a no-op that resolves so
// the flow is exercisable offline; live routes through the manager and
// surfaces its refusals (a bad signature, or FailedPrecondition when another
// upgrade is already running) to the caller with no silent fallback.
export const stageNodeImage = async (
  nodeName: string,
  { imageUrl, sha256, signature }: StageNodeImageInput,
): Promise<void> => {
  if (!imageUrl.trim()) {
    throw new Error("The image URL is required.");
  }
  if (signature.length === 0) {
    throw new Error("The release signature is required.");
  }

  if (fleetMode() === "mock") {
    return;
  }

  await fleetClient().stageNodeImage({ imageUrl, nodeName, sha256, signature });
};

// activateNodeImage reboots a managed node so a staged image starts running
// (cryptosctl image activate). The operator must echo the node's CA CN as
// confirmation, the same confirmation RebootNode requires, because
// activating is itself a reboot.
export const activateNodeImage = async (nodeName: string, confirmCaCn: string): Promise<void> => {
  if (!confirmCaCn.trim()) {
    throw new Error("Type the node's CA CN to confirm activation.");
  }

  if (fleetMode() === "mock") {
    return;
  }

  await fleetClient().activateNodeImage({ confirmCaCn, nodeName });
};

// rollbackNodeImage puts a managed node's previously running image back on
// the boot path (cryptosctl image rollback). ActivateNodeImage (or a reboot)
// is still needed to actually boot it.
export const rollbackNodeImage = async (nodeName: string): Promise<void> => {
  if (fleetMode() === "mock") {
    return;
  }

  await fleetClient().rollbackNodeImage({ nodeName });
};
