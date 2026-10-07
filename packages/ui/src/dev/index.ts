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

// Development-only pieces, kept out of the package's main index so a
// production bundle never pulls them in by accident. Import from
// "@cryptos-pki/ui/dev" only behind the console's own build-flag gate.
export { createErrorRing, type ErrorRing } from "./error-ring";
export {
  buildUiIssueBundle,
  redactMessage,
  type RingError,
  UI_ISSUE_MARKER,
  type UiIssueInput,
} from "./ui-issue";
export { UiIssueCopy } from "./ui-issue-copy";
