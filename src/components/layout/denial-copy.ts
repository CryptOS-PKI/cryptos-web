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

import type { DenialReason } from "@/context/auth";

// Each denial gets its own copy, because each one has a different fix. Sending
// an operator to install a certificate when the manager is simply unreachable
// wastes their time.
export const denialCopy: Record<DenialReason, { detail: string; title: string }> = {
  "certificate-not-sent": {
    detail:
      "Your browser connected without sending a certificate. If one is installed, the browser has remembered not to send it to this site: fully quit and restart the browser, then log in again. Otherwise, install one.",
    title: "Certificate not sent",
  },
  "no-certificate": {
    detail:
      "Your browser did not present one, so there is nothing to log in with. The service is running -- this is a certificate you need to install, not an outage.",
    title: "No operator certificate",
  },
  "not-authorized": {
    detail:
      "The certificate your browser presented is not authorized for this fleet. It may lack an access level, or it may have been revoked.",
    title: "Certificate not authorized",
  },
  unavailable: {
    detail:
      "The Fleet Manager API could not be reached. The service may be starting, or the node it proxies may be down.",
    title: "Fleet Manager unavailable",
  },
};
