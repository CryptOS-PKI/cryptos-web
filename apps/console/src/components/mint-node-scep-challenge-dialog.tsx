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

import { Button, Dialog, Field, Input, Notice, ShownOnceSecret } from "@cryptos-pki/ui";
import { useState } from "react";

import { mintNodeScepChallenge } from "@/lib/node-scep-challenges";

const parseBoundNames = (raw: string): string[] =>
  raw
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n !== "");

// MintNodeScepChallengeDialog mints a one-time SCEP challenge password on a
// managed node, for example to enroll a network device via its SCEP
// trustpoint. The plaintext lives only in this dialog's state: the page is
// told a challenge was made, never what the password is, and closing the
// dialog discards it.
export const MintNodeScepChallengeDialog = ({
  nodeName,
  onClose,
  onMinted,
}: {
  nodeName: string;
  onClose: () => void;
  onMinted: () => void;
}) => {
  const [profile, setProfile] = useState("");
  const [ttlSeconds, setTtlSeconds] = useState("3600");
  const [boundNames, setBoundNames] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [challengePassword, setChallengePassword] = useState("");

  const close = () => {
    setChallengePassword("");
    onClose();
  };

  const mint = () => {
    setPending(true);
    setError(null);
    mintNodeScepChallenge(nodeName, {
      boundNames: parseBoundNames(boundNames),
      profile: profile.trim(),
      ttlSeconds: Number(ttlSeconds) || 0,
    })
      .then((result) => {
        setChallengePassword(result.challengePassword);
        setPending(false);
        onMinted();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Mint failed");
        setPending(false);
      });
  };

  return (
    <Dialog
      description={nodeName}
      footer={
        challengePassword ? null : (
          <>
            <Button disabled={pending} onClick={close} size="sm" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} onClick={mint} size="sm">
              {pending ? "Minting…" : "Mint challenge"}
            </Button>
          </>
        )
      }
      onClose={close}
      open
      title="Mint a SCEP challenge"
    >
      {challengePassword ? (
        <ShownOnceSecret
          label="Challenge password"
          onDone={close}
          secret={challengePassword}
          warning="Give this to the device now. It will not be shown again, and the manager keeps only the challenge metadata, not the password."
        />
      ) : (
        <>
          <Field help="The node's Scep.profiles entry to issue from." label="Profile">
            <Input
              disabled={pending}
              onChange={(e) => setProfile(e.target.value)}
              value={profile}
            />
          </Field>
          <Field
            help="How long the challenge stays usable. Zero means the node's default of one hour."
            label="TTL (seconds)"
          >
            <Input
              disabled={pending}
              onChange={(e) => setTtlSeconds(e.target.value)}
              type="number"
              value={ttlSeconds}
            />
          </Field>
          <Field
            help="Optional, comma-separated. Pins the names the enrolment may request."
            label="Bound names (optional)"
          >
            <Input
              disabled={pending}
              onChange={(e) => setBoundNames(e.target.value)}
              placeholder="switch-1.example.org, 10.0.0.5"
              value={boundNames}
            />
          </Field>
          {error ? (
            <Notice role="alert" tone="danger">
              {error}
            </Notice>
          ) : null}
        </>
      )}
    </Dialog>
  );
};
