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

import { validateNodeName } from "@/lib/fleet/node-name";

describe("validateNodeName", () => {
  it("accepts a lowercase RFC 1123 label", () => {
    expect(validateNodeName("acme-issuing-02")).toBeUndefined();
    expect(validateNodeName("a")).toBeUndefined();
    expect(validateNodeName("a9")).toBeUndefined();
  });

  it.each([
    "",
    "Acme-Root",
    "has_underscore",
    "-leading-hyphen",
    "trailing-hyphen-",
    "a".repeat(64),
  ])("refuses %j as not an RFC 1123 label", (name) => {
    expect(validateNodeName(name)).toMatch(/RFC 1123|lowercase/i);
  });

  it("accepts the 63-character boundary", () => {
    expect(validateNodeName("a".repeat(63))).toBeUndefined();
  });

  it("refuses a name shaped like a node id", () => {
    expect(validateNodeName("0198c2ac-6e3f-7e3e-9b2b-9f6a7a9d2c31")).toMatch(/node ID/);
  });
});
