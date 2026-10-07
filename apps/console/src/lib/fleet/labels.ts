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

// Display labels and a pure tally, split out of lib/mock.ts: these describe
// the shared Node/NodeRole/IdentityState shapes (used for both mock and live
// data) rather than being mock fixture data themselves, so every page can
// keep importing them statically without pulling the fixtures into a release
// build (see lib/mock.ts and lib/nodes.ts for the fixtures' own gate).
import type { IdentityState, Node, NodeRole } from "@/lib/mock";

export const roleLabels: Record<NodeRole, string> = {
  root: "Root CA",
  intermediate: "Intermediate CA",
  issuing: "Issuing CA",
};

export const identityStateLabels: Record<IdentityState, string> = {
  ESTABLISHED: "ESTABLISHED",
  AWAITING_CERT: "AWAITING_CERT",
  REVOKED: "REVOKED",
};

/** Per-state member counts for a set of nodes. */
export interface StateSummary {
  established: number;
  pending: number;
  revoked: number;
}

/** Tally a set of nodes by identity state. */
export const summarize = (nodes: Node[]): StateSummary => {
  const summary: StateSummary = { established: 0, pending: 0, revoked: 0 };
  for (const node of nodes) {
    if (node.identityState === "ESTABLISHED") summary.established += 1;
    else if (node.identityState === "AWAITING_CERT") summary.pending += 1;
    else summary.revoked += 1;
  }
  return summary;
};
