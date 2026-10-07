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

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("check-release-bundle.mjs", import.meta.url));

const run = (distDir, scriptPathOverride) =>
  spawnSync(process.execPath, [scriptPathOverride ?? scriptPath, distDir], { encoding: "utf8" });

const escapeForRegExp = (value) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

// A minimal but real-shaped dist: index.html plus one assets/*.js file, so
// validateDistDir() passes and only the marker scan in `jsContents` is
// actually under test.
const writeDistShape = (distDir, jsContents) => {
  mkdirSync(path.join(distDir, "assets"), { recursive: true });
  writeFileSync(path.join(distDir, "index.html"), "<!doctype html>");
  writeFileSync(path.join(distDir, "assets", "index-abc123.js"), jsContents);
};

describe("check-release-bundle", () => {
  let distDir;

  beforeEach(() => {
    distDir = mkdtempSync(path.join(tmpdir(), "check-release-bundle-"));
  });

  afterEach(() => {
    rmSync(distDir, { force: true, recursive: true });
  });

  describe("dist directory shape", () => {
    it("exits non-zero and explains when the dist directory doesn't exist", () => {
      rmSync(distDir, { force: true, recursive: true });

      const result = run(distDir);

      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /does not exist/);
    });

    it("exits non-zero and explains when the dist directory is empty", () => {
      const result = run(distDir);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /is empty/);
    });

    it("exits non-zero when index.html is missing", () => {
      mkdirSync(path.join(distDir, "assets"), { recursive: true });
      writeFileSync(path.join(distDir, "assets", "index-abc123.js"), "console.log(1);");

      const result = run(distDir);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /index\.html/);
    });

    it("exits non-zero when no assets/*.js file exists", () => {
      writeFileSync(path.join(distDir, "index.html"), "<!doctype html>");

      const result = run(distDir);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /assets.*\.js/);
    });
  });

  describe("marker scan", () => {
    it("exits 0 when no built file carries a marker", () => {
      writeDistShape(distDir, 'console.log("hello");');

      const result = run(distDir);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /release bundle clean/);
    });

    for (const marker of ["__CRYPTOS_DEV_UI_ISSUE__", "__CRYPTOS_MOCK__", "c2pa"]) {
      it(`exits 1 and names the file when a built file carries ${marker}`, () => {
        writeDistShape(distDir, `const m="${marker}";console.log(m);`);

        const result = run(distDir);

        assert.equal(result.status, 1);
        assert.match(result.stderr, /development-only code/);
        assert.match(
          result.stderr,
          new RegExp(escapeForRegExp(path.join(distDir, "assets", "index-abc123.js"))),
        );
      });
    }
  });

  describe("entry-point guard", () => {
    it("still runs the check when the script and the dist path both contain a space", () => {
      const spacedScriptDir = mkdtempSync(path.join(tmpdir(), "check release bundle "));
      const spacedScriptPath = path.join(spacedScriptDir, "check-release-bundle.mjs");
      cpSync(scriptPath, spacedScriptPath);
      const spacedDistDir = mkdtempSync(path.join(tmpdir(), "release dist "));

      try {
        writeDistShape(spacedDistDir, 'console.log("hello");');

        const result = run(spacedDistDir, spacedScriptPath);

        assert.equal(result.status, 0);
        assert.match(result.stdout, /release bundle clean/);
      } finally {
        rmSync(spacedScriptDir, { force: true, recursive: true });
        rmSync(spacedDistDir, { force: true, recursive: true });
      }
    });
  });
});
