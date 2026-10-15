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
  listNodeScepChallenges,
  mintNodeScepChallenge,
  revokeNodeScepChallenge,
} from "@/lib/node-scep-challenges";

describe("listNodeScepChallenges (mock mode)", () => {
  it("returns a deterministic demo challenge", async () => {
    const challenges = await listNodeScepChallenges("acme-issuing-01");
    expect(challenges.length).toBeGreaterThan(0);
  });
});

describe("mintNodeScepChallenge (mock mode)", () => {
  it("returns a non-empty one-time password and a matching challenge", async () => {
    const result = await mintNodeScepChallenge("acme-issuing-01", {
      boundNames: ["switch-1.example.org"],
      profile: "network-device",
      ttlSeconds: 3600,
    });
    expect(result.challengePassword.length).toBeGreaterThan(0);
    expect(result.challenge.profile).toBe("network-device");
    expect(result.challenge.boundNames).toEqual(["switch-1.example.org"]);
  });
});

describe("revokeNodeScepChallenge", () => {
  it("is a no-op that resolves in mock mode", async () => {
    await expect(revokeNodeScepChallenge("acme-issuing-01", "ch-mock-1")).resolves.toBeUndefined();
  });
});
