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

// Fails a release build that still ships development-only code: the dev
// "Copy for UI issue" button (gated on a build arg a release build never
// sets), the mock fixtures (gated on VITE_FLEET_MODE), or an embedded
// design-tool asset manifest. Walks every file under the given dist
// directory and greps it for the markers; `latin1` reads binary assets
// (fonts, images) without throwing on invalid UTF-8.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const MARKERS = ["__CRYPTOS_DEV_UI_ISSUE__", "__CRYPTOS_MOCK__", "c2pa"];

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

// The files under distDir that carry any marker. Exported so the test can
// exercise the scan without going through the CLI's process.exit.
export const findDevCode = (distDir) =>
  walk(distDir).filter((file) => {
    const contents = readFileSync(file, "latin1");
    return MARKERS.some((marker) => contents.includes(marker));
  });

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const distDir = process.argv[2] ?? "apps/console/dist";
  const hits = findDevCode(distDir);
  if (hits.length > 0) {
    console.error(`release bundle contains development-only code:\n${hits.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("release bundle clean");
  }
}
