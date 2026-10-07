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

import { describe, expect, it } from "vitest";

import * as ui from "./index";

// The console imports every primitive from the package root, so each kit
// component the screens rely on has to stay a named export there.
describe("@cryptos-pki/ui exports", () => {
  it.each([
    "AppShell",
    "Badge",
    "BannerStack",
    "Button",
    "CopyBlock",
    "DataTable",
    "Dialog",
    "EmptyState",
    "Field",
    "FieldTile",
    "FingerprintConfirm",
    "Input",
    "KeyBackupStep",
    "Notice",
    "PhaseRail",
    "ShownOnceSecret",
    "StatusBadge",
    "Stepper",
    "ThemeToggle",
    "TrustChainChip",
    "TypeToConfirm",
  ])("exports %s", (name) => {
    expect(ui).toHaveProperty(name);
  });
});
