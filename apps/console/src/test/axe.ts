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

// Mirrors @cryptos-pki/ui's src/test/axe.ts (not exported from the kit's
// package.json), so the console's page tests run the same P1 a11y harness.
// Colour contrast and target-size stay off for the same reason: jsdom has no
// layout, so both checks would pass vacuously rather than catch anything.
export const expectNoA11yViolations = async (container: Element): Promise<void> => {
  const results = await axe(container, {
    rules: { "color-contrast": { enabled: false }, "target-size": { enabled: false } },
  });
  if (results.violations.length === 0) return;
  const detail = results.violations
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    .join("\n");
  throw new Error(`axe violations:\n${detail}`);
};
