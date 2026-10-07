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

import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Dev-only: compiled out when unset, so the "Copy for UI issue" button's
  // code is absent from a build that doesn't ask for it.
  define: {
    "import.meta.env.DEV_UI_ISSUE_COPY": JSON.stringify(process.env.DEV_UI_ISSUE_COPY ?? "false"),
    // Deliberately a different name from VITE_FLEET_MODE: that one stays a
    // plain, unreplaced import.meta.env read (lib/fleet/mode.ts's fleetMode()),
    // because tests reassign it at runtime (vi.stubEnv, direct assignment) to
    // switch data source mid-suite, which a literal substitution would break.
    // This flag is fixed for the whole build and lets Vite fold away
    // lib/mock.ts's fixtures (dev-only: see lib/nodes.ts and lib/certs.ts)
    // whenever the build arg isn't VITE_FLEET_MODE=mock.
    "import.meta.env.MOCK_FIXTURES_BUILD": JSON.stringify(
      process.env.VITE_FLEET_MODE === "mock" ? "true" : "false",
    ),
    // Vite only auto-exposes process.env vars already prefixed VITE_; GITHUB_SHA
    // (set by Actions) is not, so this needs an explicit define to fall back to it.
    "import.meta.env.VITE_GIT_SHA": JSON.stringify(
      process.env.VITE_GIT_SHA ?? process.env.GITHUB_SHA ?? "",
    ),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Dev-only: proxy the Connect API to the local manager so the browser talks
  // only to the vite origin (no separate manager port / CORS). Target overridable
  // via VITE_MANAGER_PROXY for the local ESXi E2E.
  server: {
    proxy: {
      "/cryptos.fleet.v1.BootstrapService": {
        changeOrigin: true,
        target: process.env.VITE_MANAGER_PROXY ?? "http://127.0.0.1:18099",
      },
      "/cryptos.fleet.v1.FleetService": {
        changeOrigin: true,
        target: process.env.VITE_MANAGER_PROXY ?? "http://127.0.0.1:18099",
      },
      "/oauth2": {
        changeOrigin: true,
        target: process.env.VITE_MANAGER_PROXY ?? "http://127.0.0.1:18099",
      },
    },
  },
  test: {
    css: true,
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
