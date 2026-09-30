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

import type { CertProfile } from "@/lib/profiles";

// DriftStatus classifies a profile name across the catalog and a node:
//   in-sync     the same name exists on both and every field matches
//   drifted     the same name exists on both but a field differs
//   node-only   the node has a profile the catalog does not (informational)
//   not-applied the catalog has a profile the node does not yet carry
export type DriftStatus = "drifted" | "in-sync" | "node-only" | "not-applied";

// FieldDiff names one differing field with its catalog and node renderings.
export interface FieldDiff {
  catalog: string;
  field: string;
  node: string;
}

// DriftRow is one profile name's drift verdict. fieldDiffs is populated only
// for a drifted row, listing every field that differs in a deterministic order.
export interface DriftRow {
  fieldDiffs?: FieldDiff[];
  name: string;
  status: DriftStatus;
}

// render turns a comparable field value into a stable display string.
const render = (value: unknown): string => {
  if (value === undefined) return "—";
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.join(", ");
  return String(value);
};

// fieldValues projects a profile onto an ordered list of comparable, named
// fields. The order is fixed so a field-diff list is deterministic. Repeated
// string lists are sorted so ordering alone is not treated as drift.
const fieldValues = (p: CertProfile): { field: string; value: unknown }[] => {
  const sortedSan = (list: string[]): string[] => [...list].sort();
  const sortedUsage = (list: string[]): string[] => [...list].sort();
  return [
    { field: "keyAlg", value: p.keyAlg },
    { field: "validityDays", value: p.validityDays },
    { field: "isCA", value: p.isCA },
    { field: "pathLen", value: p.pathLen },
    { field: "keyUsage", value: sortedUsage(p.keyUsage) },
    { field: "extKeyUsage", value: sortedUsage(p.extKeyUsage) },
    { field: "subject.commonName", value: p.subject.commonName },
    { field: "subject.organization", value: p.subject.organization },
    { field: "subject.country", value: p.subject.country },
    { field: "sans.dns", value: sortedSan(p.sans.dns) },
    { field: "sans.ip", value: sortedSan(p.sans.ip) },
    { field: "sans.email", value: sortedSan(p.sans.email) },
    { field: "sans.uri", value: sortedSan(p.sans.uri) },
    {
      field: "extraExtensions",
      value: [...p.extraExtensions]
        .map((e) => `${e.oid}:${e.critical ? "c" : ""}:${e.value}`)
        .sort(),
    },
  ];
};

// diffProfiles returns every field where the catalog and node profiles differ,
// in the fixed field order. An empty result means the two are equal by value.
const diffProfiles = (catalog: CertProfile, node: CertProfile): FieldDiff[] => {
  const cv = fieldValues(catalog);
  const nv = fieldValues(node);
  const diffs: FieldDiff[] = [];
  for (let i = 0; i < cv.length; i += 1) {
    const c = render(cv[i].value);
    const n = render(nv[i].value);
    if (c !== n) diffs.push({ catalog: c, field: cv[i].field, node: n });
  }
  return diffs;
};

// computeDrift compares the manager catalog to a node's applied profiles and
// returns one DriftRow per distinct profile name, in stable name order. It is
// pure: no clock, no I/O, deterministic for the same inputs.
export const computeDrift = (catalog: CertProfile[], nodeProfiles: CertProfile[]): DriftRow[] => {
  const byNameCatalog = new Map(catalog.map((p) => [p.name, p]));
  const byNameNode = new Map(nodeProfiles.map((p) => [p.name, p]));

  const names = [...new Set([...byNameCatalog.keys(), ...byNameNode.keys()])].sort();

  return names.map((name) => {
    const c = byNameCatalog.get(name);
    const n = byNameNode.get(name);

    if (c && !n) return { name, status: "not-applied" };
    if (!c && n) return { name, status: "node-only" };

    const diffs = diffProfiles(c as CertProfile, n as CertProfile);
    if (diffs.length === 0) return { name, status: "in-sync" };
    return { fieldDiffs: diffs, name, status: "drifted" };
  });
};
