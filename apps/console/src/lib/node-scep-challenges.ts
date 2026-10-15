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

import { fleetClient } from "@/lib/fleet/client";
import { fleetMode } from "@/lib/fleet/mode";

// NodeScepChallenge is a one-time SCEP challenge on a managed node, without
// the challenge itself, which only mintNodeScepChallenge's result carries.
export interface NodeScepChallenge {
  boundNames: string[];
  createdAt: string;
  createdByCn: string;
  expiresAt: string;
  id: string;
  profile: string;
}

const mockChallenges = (): NodeScepChallenge[] => [
  {
    boundNames: [],
    createdAt: "2026-10-14T00:00:00Z",
    createdByCn: "admin@acme.example",
    expiresAt: "2026-10-15T00:00:00Z",
    id: "ch-mock-1",
    profile: "network-device",
  },
];

// listNodeScepChallenges lists a managed node's usable SCEP challenges,
// soonest to expire first. Operator level or above; mock mode returns a
// small canned set.
export const listNodeScepChallenges = async (nodeName: string): Promise<NodeScepChallenge[]> => {
  if (fleetMode() === "mock") {
    return mockChallenges();
  }

  const response = await fleetClient().listNodeScepChallenges({ nodeName });
  return response.challenges.map((c) => ({
    boundNames: c.boundNames,
    createdAt: c.createdAt,
    createdByCn: c.createdByCn,
    expiresAt: c.expiresAt,
    id: c.id,
    profile: c.profile,
  }));
};

export interface MintNodeScepChallengeInput {
  boundNames: string[];
  profile: string;
  ttlSeconds: number;
}

export interface MintNodeScepChallengeResult {
  challenge: NodeScepChallenge;
  challengePassword: string;
}

// mintNodeScepChallenge mints a one-time SCEP challenge password on a
// managed node, for example to enroll a network device via its SCEP
// trustpoint. The password is returned once; the caller must not persist it
// anywhere but the operator's own clipboard.
export const mintNodeScepChallenge = async (
  nodeName: string,
  { boundNames, profile, ttlSeconds }: MintNodeScepChallengeInput,
): Promise<MintNodeScepChallengeResult> => {
  if (fleetMode() === "mock") {
    return {
      challenge: {
        boundNames,
        createdAt: new Date().toISOString(),
        createdByCn: "you@acme.example",
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        id: "ch-mock-new",
        profile,
      },
      challengePassword: "mock-challenge-password-00000000",
    };
  }

  const response = await fleetClient().mintNodeScepChallenge({
    boundNames,
    nodeName,
    profile,
    ttlSeconds,
  });
  const challenge = response.challenge;
  return {
    challenge: {
      boundNames: challenge?.boundNames ?? [],
      createdAt: challenge?.createdAt ?? "",
      createdByCn: challenge?.createdByCn ?? "",
      expiresAt: challenge?.expiresAt ?? "",
      id: challenge?.id ?? "",
      profile: challenge?.profile ?? "",
    },
    challengePassword: response.challengePassword,
  };
};

// revokeNodeScepChallenge withdraws a managed node's SCEP challenge before it
// is used or expires.
export const revokeNodeScepChallenge = async (nodeName: string, id: string): Promise<void> => {
  if (fleetMode() === "mock") {
    return;
  }

  await fleetClient().revokeNodeScepChallenge({ id, nodeName });
};
