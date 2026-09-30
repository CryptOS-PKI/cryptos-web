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

// The single data-source seam for the Fleet Manager web UI. `live` (the
// default) routes reads through the manager over Connect; `live-auth` is the
// same live path with the gateway session attached (not yet lit -- treated as
// `live` by consumers until the BFF/session wiring lands). `mock` is an
// explicit dev opt-in (VITE_FLEET_MODE=mock) that keeps every surface on the
// in-memory fixtures for offline UI work. Unset or unrecognized values default
// to `live` now that the full loop is proven against a real node (X1 cutover).
export type FleetMode = "live" | "live-auth" | "mock";

export const fleetMode = (): FleetMode => {
  const raw = import.meta.env.VITE_FLEET_MODE;
  if (raw === "mock" || raw === "live-auth") return raw;
  return "live";
};
