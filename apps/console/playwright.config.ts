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

import { defineConfig, devices } from "@playwright/test";

// Console screenshots for the website and docs. A preview server serves a
// fixture-backed build (VITE_FLEET_MODE=mock, no real keys or hosts).
const PORT = 4173;

const preview = (outDir: string, port: number) => ({
  command: `npx vite build --outDir ${outDir} --emptyOutDir && npx vite preview --outDir ${outDir} --host 127.0.0.1 --port ${port} --strictPort`,
  env: { VITE_FLEET_MODE: "mock" },
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
  url: `http://127.0.0.1:${port}`,
});

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  outputDir: "test-results",
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { height: 900, width: 1440 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e",
  testMatch: "**/*.shots.ts",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: preview("dist-shots", PORT),
  workers: process.env.CI ? 2 : undefined,
});
