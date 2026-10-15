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

import {
  approveNodeScepEnrollment,
  listNodeScepEnrollments,
  rejectNodeScepEnrollment,
} from "@/lib/node-scep-enrollments";

describe("listNodeScepEnrollments (mock mode)", () => {
  it("returns a deterministic demo enrolment", async () => {
    const enrollments = await listNodeScepEnrollments("acme-issuing-01");
    expect(enrollments.length).toBeGreaterThan(0);
  });

  it("filters by profile", async () => {
    expect(await listNodeScepEnrollments("acme-issuing-01", "no-such-profile")).toEqual([]);
  });
});

describe("approveNodeScepEnrollment (mock mode)", () => {
  it("returns a non-empty serial", async () => {
    const serial = await approveNodeScepEnrollment("acme-issuing-01", "enr-mock-1");
    expect(serial.length).toBeGreaterThan(0);
  });
});

describe("rejectNodeScepEnrollment", () => {
  it("is a no-op that resolves in mock mode", async () => {
    await expect(
      rejectNodeScepEnrollment("acme-issuing-01", "enr-mock-1", "unexpected device"),
    ).resolves.toBeUndefined();
  });
});
