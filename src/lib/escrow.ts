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

import { generateStrongPassphrase, MIN_PASSPHRASE_LENGTH } from "@/lib/crypto/leaf-key";
import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// Re-export the shared passphrase helpers so escrow callers have one import.
// The floor (>= 18) and the generator (crypto.getRandomValues) are the same
// ones the leaf-key export uses, keeping every secret-entry surface consistent.
export { generateStrongPassphrase, MIN_PASSPHRASE_LENGTH };

// RestoredIdentity is the CN summary the manager returns after an import, so
// the UI can confirm what was restored without handling the full chain.
export interface RestoredIdentity {
  issuerCn: string;
  subjectCn: string;
}

// exportCAKey asks the manager to relay a node's encrypted CA-key backup. The
// passphrase seals the backup node-side; the plaintext key never leaves the
// node, and this function returns only the opaque encrypted envelope for the
// caller to download. In `mock` mode it returns a dummy envelope so the flow is
// exercisable offline; in live mode a manager/node error surfaces to the caller
// (no silent fallback). The passphrase is validated (>= MIN_PASSPHRASE_LENGTH)
// here too, matching the manager's server-side guard.
export const exportCAKey = async (nodeName: string, passphrase: string): Promise<Uint8Array> => {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }

  if (fleetMode() === "mock") {
    return new TextEncoder().encode(`mock-encrypted-envelope-for-${nodeName}`);
  }

  const response = await fleetClient().exportCAKey({
    nodeName,
    passphrase: new TextEncoder().encode(passphrase),
  });
  return response.envelope;
};

// importCAKey relays an encrypted envelope and its passphrase to a fresh node
// through the manager, returning the restored identity's CN summary. In `mock`
// mode it returns a canned summary; in live mode a manager/node error (for
// example the target already holding an identity) surfaces to the caller.
export const importCAKey = async (
  nodeName: string,
  envelope: Uint8Array,
  passphrase: string,
): Promise<RestoredIdentity> => {
  if (envelope.length === 0) {
    throw new Error("A backup envelope file is required.");
  }
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }

  if (fleetMode() === "mock") {
    return { issuerCn: `Restored issuer for ${nodeName}`, subjectCn: `Restored CA on ${nodeName}` };
  }

  const response = await fleetClient().importCAKey({
    envelope,
    nodeName,
    passphrase: new TextEncoder().encode(passphrase),
  });
  return { issuerCn: response.issuerCn, subjectCn: response.subjectCn };
};
