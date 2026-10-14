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

import { type Status, StatusBadge } from "@cryptos-pki/ui";

import type { IdentityState } from "@/lib/mock";

// Maps a node's identity state to the kit's shape-coded status badge. Revoked
// is included for the full state palette even though the mock fixtures do not
// currently produce it.
type Presentation = { label: string; status: Status };

const presentation: Record<"REVOKED" | IdentityState, Presentation> = {
  AWAITING_CERT: { label: "Pending", status: "pending" },
  ESTABLISHED: { label: "Verified", status: "established" },
  REVOKED: { label: "Revoked", status: "revoked" },
};

export const IdentityBadge = ({ state }: { state: "REVOKED" | IdentityState }) => {
  const { label, status } = presentation[state];
  return <StatusBadge status={status}>{label}</StatusBadge>;
};
