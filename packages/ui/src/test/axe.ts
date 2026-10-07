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

import { axe } from "vitest-axe";

// expectNoA11yViolations runs axe-core over a rendered container and throws
// with every violation id and target when any rule fails. Colour contrast is
// skipped here because jsdom has no layout; contrast is checked on the
// sign-off page and in the token tests.
export const expectNoA11yViolations = async (container: Element): Promise<void> => {
  const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
  if (results.violations.length === 0) return;
  const detail = results.violations
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    .join("\n");
  throw new Error(`axe violations:\n${detail}`);
};
