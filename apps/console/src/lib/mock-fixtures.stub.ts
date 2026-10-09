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

// The release build's `@/lib/mock-fixtures` (see vite.config.ts's
// resolve.alias): empty stand-ins, same shapes as mock-fixtures.real.ts's
// exports, carrying none of the fixture data. Consumers (lib/nodes.ts,
// lib/certs.ts, lib/mock.ts, lib/enrollment.ts, lib/profiles.ts,
// lib/adapters.ts, lib/audit.ts) read fleetMode() to decide whether to use
// this data at all; this file only has to exist so a build that isn't
// VITE_FLEET_MODE=mock, and isn't running under Vitest, never resolves
// mock-fixtures.real.ts in the first place.
import type { EnrollmentAdapter } from "@/lib/adapters";
import type { AuditEvent } from "@/lib/audit";
import type { EnrollmentRequest } from "@/lib/enrollment";
import type { Node } from "@/lib/mock";
import type { CertProfile } from "@/lib/profiles";

export const mockNodes: Node[] = [];
export const mockEnrollments: EnrollmentRequest[] = [];
export const mockProfiles: CertProfile[] = [];
export const mockAdapters: EnrollmentAdapter[] = [];
export const mockAuditEvents: AuditEvent[] = [];
