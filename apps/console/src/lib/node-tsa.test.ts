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

import { listNodeTsaCertificates } from "@/lib/node-tsa";

describe("listNodeTsaCertificates (mock mode)", () => {
  it("returns a deterministic demo certificate with one marked current", async () => {
    const certificates = await listNodeTsaCertificates("acme-issuing-01");
    expect(certificates.length).toBeGreaterThan(0);
    expect(certificates.filter((c) => c.current)).toHaveLength(1);
  });

  it("orders certificates newest first", async () => {
    const certificates = await listNodeTsaCertificates("acme-issuing-01");
    const notBefores = certificates.map((c) => c.notBefore);
    expect([...notBefores].sort().reverse()).toEqual(notBefores);
  });
});
