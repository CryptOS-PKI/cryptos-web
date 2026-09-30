/*
Apache License 2.0

Copyright 2026 Shane

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

import { computeDrift } from "@/lib/profile-drift";
import { type CertProfile, emptySans, emptySubject } from "@/lib/profiles";

const profile = (name: string, over: Partial<CertProfile> = {}): CertProfile => ({
  extKeyUsage: ["server_auth"],
  extraExtensions: [],
  isCA: false,
  keyAlg: "ECDSA-P384",
  keyUsage: ["digital_signature"],
  name,
  sans: emptySans(),
  subject: emptySubject(),
  validityDays: 365,
  ...over,
});

describe("computeDrift", () => {
  it("reports in-sync for identical profiles regardless of list ordering", () => {
    const catalog = [profile("web", { keyUsage: ["digital_signature", "key_encipherment"] })];
    const node = [profile("web", { keyUsage: ["key_encipherment", "digital_signature"] })];
    const rows = computeDrift(catalog, node);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("in-sync");
    expect(rows[0].fieldDiffs).toBeUndefined();
  });

  it("reports drifted with the differing field listed", () => {
    const catalog = [profile("web", { validityDays: 365 })];
    const node = [profile("web", { validityDays: 90 })];
    const rows = computeDrift(catalog, node);
    expect(rows[0].status).toBe("drifted");
    const diff = rows[0].fieldDiffs?.find((d) => d.field === "validityDays");
    expect(diff).toEqual({ catalog: "365", field: "validityDays", node: "90" });
  });

  it("reports node-only for a profile the catalog lacks", () => {
    const rows = computeDrift([], [profile("orphan")]);
    expect(rows[0]).toEqual({ name: "orphan", status: "node-only" });
  });

  it("reports not-applied for a catalog profile the node lacks", () => {
    const rows = computeDrift([profile("web")], []);
    expect(rows[0]).toEqual({ name: "web", status: "not-applied" });
  });

  it("returns rows in stable name order across all four states", () => {
    const catalog = [profile("b"), profile("a"), profile("c", { validityDays: 10 })];
    const node = [profile("c", { validityDays: 20 }), profile("d"), profile("a")];
    const rows = computeDrift(catalog, node);
    expect(rows.map((r) => r.name)).toEqual(["a", "b", "c", "d"]);
    expect(rows.map((r) => r.status)).toEqual(["in-sync", "not-applied", "drifted", "node-only"]);
  });
});
