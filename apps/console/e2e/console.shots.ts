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

import { expect, test } from "@playwright/test";

// Every main screen, light and dark, full page. Files land in
// screenshots/<theme>-<project>/<name>.png; the CI job uploads that folder.

// Mock mode keeps the session in memory, so every capture starts at the
// sign-in screen and logs in as the fixture operator.
const signIn = async (page: import("@playwright/test").Page, path: string) => {
  await page.goto(path);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log in" })).toBeHidden();
};

const SCREENS: { heading?: RegExp; name: string; path: string }[] = [
  { name: "fleet-overview", path: "/" },
  { name: "fleet", path: "/fleet" },
  { name: "nodes", path: "/nodes" },
  { name: "certificates", path: "/certificates" },
  { name: "issue", path: "/nodes/acme-issuing-01/issue" },
  { name: "enrolments", path: "/enrollment" },
  { name: "approvals", path: "/approvals" },
  { name: "settings-profiles", path: "/profiles" },
  { name: "settings-protocols", path: "/protocols" },
];

for (const theme of ["light", "dark"] as const) {
  test.describe(theme, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("cryptos-theme", value), theme);
    });

    const shot = async (
      page: import("@playwright/test").Page,
      project: string,
      name: string,
      fullPage = true,
    ) => {
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        animations: "disabled",
        fullPage,
        path: `screenshots/${theme}-${project}/${name}.png`,
      });
    };

    test("sign-in", async ({ page }, info) => {
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
      await shot(page, info.project.name, "sign-in");
    });

    for (const screen of SCREENS) {
      test(screen.name, async ({ page }, info) => {
        await signIn(page, screen.path);
        await shot(page, info.project.name, screen.name);
      });
    }

    test("revoke", async ({ page }, info) => {
      await signIn(page, "/nodes/acme-issuing-01");
      await page.getByRole("button", { name: "Revoke" }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot(page, info.project.name, "revoke", false);
    });
  });
}
