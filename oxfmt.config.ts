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

import shared from "@bugs5382/node-oxlint-config/oxfmt";

export default {
  ...shared,
  ignorePatterns: [
    ...shared.ignorePatterns,
    "dist/**",
    "coverage/**",
    "package-lock.json",
    ".github/**",
    ".claude/**",
    ".golic.yaml",
    ".gitleaks.toml",
    ".licignore",
    "AGENTS.md",
    "CLAUDE.md",
    "LICENSE",
    "NOTICE",
    "Taskfile.yml",
    "packages/api-client/src/gen/**",
    "packages/api-client/.protos/**",
    "packages/ui/src/icons/Icon*.tsx",
    "packages/ui/src/icons/index.ts",
  ],
  printWidth: 100,
};
