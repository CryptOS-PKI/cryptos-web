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
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // loadEnv (not a bare process.env.VITE_FLEET_MODE read) so a value set in
  // an .env file and one set in the shell agree -- the app's own
  // import.meta.env.VITE_FLEET_MODE (lib/fleet/mode.ts's fleetMode()) is
  // populated by Vite from the same loadEnv merge, so this was a second,
  // easy-to-drift source of truth otherwise.
  const env = loadEnv(mode, process.cwd(), "");
  // The real fixtures (mock-fixtures.real.ts) only for an explicit mock build
  // or under Vitest, which always wants them regardless of VITE_FLEET_MODE
  // (the suite pins fleetMode() to "mock" itself in src/test/setup.ts; it
  // still needs the data to read); every other build gets
  // mock-fixtures.stub.ts's empty array instead.
  const mockFixturesPath =
    env.VITE_FLEET_MODE === "mock" || process.env.VITEST === "true"
      ? "./src/lib/mock-fixtures.real.ts"
      : "./src/lib/mock-fixtures.stub.ts";

  return {
    // Dev-only: compiled out when unset, so the "Copy for UI issue" button's
    // code is absent from a build that doesn't ask for it.
    define: {
      "import.meta.env.DEV_UI_ISSUE_COPY": JSON.stringify(process.env.DEV_UI_ISSUE_COPY ?? "false"),
      // Vite only auto-exposes process.env vars already prefixed VITE_; GITHUB_SHA
      // (set by Actions) is not, so this needs an explicit define to fall back to it.
      "import.meta.env.VITE_GIT_SHA": JSON.stringify(
        process.env.VITE_GIT_SHA ?? process.env.GITHUB_SHA ?? "",
      ),
    },
    plugins: [react()],
    resolve: {
      // An array, not an object: Vite matches aliases in list order (first
      // match wins), and an object's keys would be alphabetized by the lint
      // config, which would check "@" first and always win (every
      // "@/lib/mock-fixtures" import also matches the "@/" prefix "@"
      // aliases) -- silently routing every import to src/lib/mock-fixtures,
      // a path that doesn't exist. Listed first so it matches before "@"
      // falls through, this stable, always-importable specifier resolves to
      // whichever fixtures file this build wants, never both, so a release
      // build's bundle never contains mock-fixtures.real.ts's data at all.
      alias: [
        { find: "@/lib/mock-fixtures", replacement: path.resolve(__dirname, mockFixturesPath) },
        { find: "@", replacement: path.resolve(__dirname, "./src") },
      ],
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
  };
});
