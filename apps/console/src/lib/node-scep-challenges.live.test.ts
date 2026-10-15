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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listNodeScepChallenges = vi.fn(() =>
  Promise.resolve({
    challenges: [
      {
        boundNames: ["switch-1.example.org"],
        createdAt: "2026-01-01T00:00:00Z",
        createdByCn: "admin@acme.example",
        expiresAt: "2026-01-02T00:00:00Z",
        id: "ch-live-1",
        profile: "network-device",
      },
    ],
  }),
);
const mintNodeScepChallenge = vi.fn(() =>
  Promise.resolve({
    challenge: {
      boundNames: [],
      createdAt: "2026-01-01T00:00:00Z",
      createdByCn: "admin@acme.example",
      expiresAt: "2026-01-02T00:00:00Z",
      id: "ch-live-new",
      profile: "network-device",
    },
    challengePassword: "live-one-time-password",
  }),
);
const revokeNodeScepChallenge = vi.fn(() => Promise.resolve({ challenge: { id: "ch-live-1" } }));
vi.mock("@/lib/fleet/client", () => ({
  fleetClient: () => ({ listNodeScepChallenges, mintNodeScepChallenge, revokeNodeScepChallenge }),
}));

import {
  listNodeScepChallenges as listNodeScepChallengesLib,
  mintNodeScepChallenge as mintNodeScepChallengeLib,
  revokeNodeScepChallenge as revokeNodeScepChallengeLib,
} from "@/lib/node-scep-challenges";

describe("node-scep-challenges live path", () => {
  beforeEach(() => {
    listNodeScepChallenges.mockClear();
    mintNodeScepChallenge.mockClear();
    revokeNodeScepChallenge.mockClear();
    vi.stubEnv("VITE_FLEET_MODE", "live");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("listNodeScepChallenges forwards the node name and flattens the response", async () => {
    const challenges = await listNodeScepChallengesLib("acme-issuing-01");
    expect(listNodeScepChallenges).toHaveBeenCalledWith(
      expect.objectContaining({ nodeName: "acme-issuing-01" }),
    );
    expect(challenges).toEqual([
      {
        boundNames: ["switch-1.example.org"],
        createdAt: "2026-01-01T00:00:00Z",
        createdByCn: "admin@acme.example",
        expiresAt: "2026-01-02T00:00:00Z",
        id: "ch-live-1",
        profile: "network-device",
      },
    ]);
  });

  it("mintNodeScepChallenge forwards profile, ttl_seconds and bound_names", async () => {
    const result = await mintNodeScepChallengeLib("acme-issuing-01", {
      boundNames: ["switch-1.example.org"],
      profile: "network-device",
      ttlSeconds: 3600,
    });
    expect(mintNodeScepChallenge).toHaveBeenCalledWith({
      boundNames: ["switch-1.example.org"],
      nodeName: "acme-issuing-01",
      profile: "network-device",
      ttlSeconds: 3600,
    });
    expect(result.challengePassword).toBe("live-one-time-password");
  });

  it("revokeNodeScepChallenge forwards the id", async () => {
    await revokeNodeScepChallengeLib("acme-issuing-01", "ch-live-1");
    expect(revokeNodeScepChallenge).toHaveBeenCalledWith({
      id: "ch-live-1",
      nodeName: "acme-issuing-01",
    });
  });
});
