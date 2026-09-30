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

import type { IdentityState } from "@/lib/mock";

import { Badge } from "@/components/ui/badge";

// Maps a node's identity state to a semantic badge. Revoked is included for the
// full state palette even though the mock fixtures do not currently produce it.
type Presentation = { label: string; variant: "destructive" | "success" | "warning" };

const presentation: Record<"REVOKED" | IdentityState, Presentation> = {
  AWAITING_CERT: { label: "Pending", variant: "warning" },
  ESTABLISHED: { label: "Verified", variant: "success" },
  REVOKED: { label: "Revoked", variant: "destructive" },
};

export const IdentityBadge = ({ state }: { state: "REVOKED" | IdentityState }) => {
  const { label, variant } = presentation[state];
  return <Badge variant={variant}>{label}</Badge>;
};
