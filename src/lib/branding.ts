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

// Operator white-label branding. This is a mock config for now — there is no
// backend that serves it yet. It controls only the operator-brandable spots
// (today: the mark inside the root node in the topology). The product wordmark
// in the top-left header is NOT brandable and always reads "CryptOS".
//
// To white-label the root mark, set `rootLogoUrl` to a self-hosted or data-URI
// image. Leave it undefined (the shipped default) to fall back to the CryptOS
// shield. Keep any value CSP-safe: no external hosts — a same-origin path or a
// `data:` URI only.

export interface Branding {
  /**
   * Optional operator logo shown inside the root node in place of the shield.
   * Undefined -> the default CryptOS shield is rendered.
   */
  rootLogoUrl?: string;
}

/** The active branding config. Default: unset -> the shield shows. */
export const branding: Branding = {
  // rootLogoUrl: "data:image/svg+xml;utf8,...",  // set to white-label the root mark
};
