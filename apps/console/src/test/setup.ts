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

import "reflect-metadata";
import "@testing-library/jest-dom/vitest";

// The app now defaults to the live data source (X1 cutover). The suite exercises
// the mock fixtures, so pin the data-source seam to mock for tests; live-path
// tests override it explicitly via vi.mock("@/lib/fleet/mode").
import.meta.env.VITE_FLEET_MODE = "mock";

// Deliberately not importing lib/nodes.ts/lib/certs.ts here to seed the
// fixtures: a handful of suites vi.mock("@/lib/fleet/client") or
// ("@/lib/fleet/mode") in their own test file, and vi.mock's hoisting only
// rewrites that file's own imports -- a static import here would resolve
// the real client/mode first and bake it into the live store before those
// mocks ever apply. Every suite that reads the fixtures calls
// __resetNodes()/__resetCerts() itself in a beforeEach instead (lib/nodes.ts
// and lib/certs.ts only self-seed on module load when MOCK_FIXTURES_BUILD --
// a vite `define` literal, see vite.config.ts -- is "true", which it isn't
// under `vitest run`).

// jsdom has no matchMedia. Stub it as reduce=true so the topology's staged
// reveal takes its instant path in tests (no rAF), keeping focus behavior
// deterministic.
globalThis.matchMedia = globalThis.matchMedia
  ? globalThis.matchMedia.bind(globalThis)
  : (query: string): MediaQueryList =>
      ({
        addEventListener: () => {},
        addListener: () => {},
        dispatchEvent: () => false,
        matches: true,
        media: query,
        onchange: null,
        removeEventListener: () => {},
        removeListener: () => {},
      }) as unknown as MediaQueryList;
