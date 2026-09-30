/*
Apache License 2.0

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
