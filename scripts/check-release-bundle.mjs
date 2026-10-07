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
//
// Exit codes (see the EXIT_* constants below): 0 clean, 1 development-only
// code found, 2 the check didn't complete -- the given dist directory is
// invalid (missing, empty, no index.html, no built JS) or something
// unexpected (e.g. an unreadable file) broke the scan -- distinct from 1 so
// a caller can tell "found what it was looking for" from "never actually
// scanned anything".
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MARKERS = ["__CRYPTOS_DEV_UI_ISSUE__", "__CRYPTOS_MOCK__", "c2pa"];

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

// A missing or empty dist directory means the build never ran (or ran
// somewhere else), not a clean release -- findDevCode() alone would walk
// zero files and report "clean" either way, which is the wrong answer for
// both. Checks for the shape an actual `vite build` output has: an
// index.html, and at least one built JS chunk under assets/.
export const validateDistDir = (distDir) => {
  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    return `${distDir} does not exist`;
  }
  const files = walk(distDir);
  if (files.length === 0) {
    return `${distDir} is empty`;
  }
  if (!existsSync(path.join(distDir, "index.html"))) {
    return `${distDir} has no index.html`;
  }
  const hasBuiltAsset = files.some(
    (file) => path.basename(path.dirname(file)) === "assets" && file.endsWith(".js"),
  );
  if (!hasBuiltAsset) {
    return `${distDir} has no assets/*.js file`;
  }
  return;
};

// The files under distDir that carry any marker. Exported so the test can
// exercise the scan without going through the CLI's process.exit.
export const findDevCode = (distDir) =>
  walk(distDir).filter((file) => {
    const contents = readFileSync(file, "latin1");
    return MARKERS.some((marker) => contents.includes(marker));
  });

// Distinct exit codes, not a shared non-zero: a caller (ci-web.yml's positive
// control) that only checks "did this exit non-zero" can't tell "found
// dev-only code" (1, the thing it wants to see) from "the check didn't
// actually complete" (2: an invalid dist directory, or an unreadable file or
// other unexpected error partway through the scan -- a wrong or empty
// --outDir, or a permissions problem, would otherwise make the control pass
// without ever really checking anything). 0 is clean, same as before.
export const EXIT_CLEAN = 0;
export const EXIT_DEV_CODE_FOUND = 1;
export const EXIT_INVALID_DIST = 2;

// Runs the check and reports the result rather than exiting directly, so the
// test can call this instead of spawning the CLI -- including with a
// `findDevCode` that deliberately throws, to prove an unreadable file (or any
// other unexpected error mid-scan) is EXIT_INVALID_DIST, not an uncaught
// exception that Node turns into a bare exit 1 indistinguishable from
// EXIT_DEV_CODE_FOUND.
export const runCheck = (distDir, { findDevCode: scan = findDevCode } = {}) => {
  try {
    const distError = validateDistDir(distDir);
    if (distError) {
      return { code: EXIT_INVALID_DIST, message: `release bundle check: ${distError}` };
    }
    const hits = scan(distDir);
    if (hits.length > 0) {
      return {
        code: EXIT_DEV_CODE_FOUND,
        message: `release bundle contains development-only code:\n${hits.join("\n")}`,
      };
    }
    return { code: EXIT_CLEAN, message: "release bundle clean" };
  } catch (error) {
    return {
      code: EXIT_INVALID_DIST,
      message: `release bundle check: unexpected error scanning ${distDir}: ${error.message}`,
    };
  }
};

// pathToFileURL (not a `file://${argv[1]}` template) matches how Node itself
// builds import.meta.url: it percent-encodes characters like a space, which
// the template doesn't, so a worktree path with a space in it made the two
// strings disagree, this guard read false, and the check silently exited 0
// without scanning anything.
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const distDir = process.argv[2] ?? "apps/console/dist";
  const { code, message } = runCheck(distDir);
  if (code === EXIT_CLEAN) {
    console.log(message);
  } else {
    console.error(message);
  }
  process.exitCode = code;
}
