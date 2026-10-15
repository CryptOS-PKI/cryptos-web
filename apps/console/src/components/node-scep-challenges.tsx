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

import {
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconCertificates,
} from "@cryptos-pki/ui";
import { useEffect, useState } from "react";

import { MintNodeScepChallengeDialog } from "@/components/mint-node-scep-challenge-dialog";
import { RevokeNodeScepChallengeDialog } from "@/components/revoke-node-scep-challenge-dialog";
import { useOptionalAuth } from "@/context/auth";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { listNodeScepChallenges, type NodeScepChallenge } from "@/lib/node-scep-challenges";

// NodeScepChallenges lists a managed node's usable SCEP challenges and lets
// an operator mint a new one-time challenge password or revoke an unused
// one. Minting and revoking need operator level or above, the node's own
// write paths; viewers see the list only.
export const NodeScepChallenges = ({ nodeName }: { nodeName: string }) => {
  const isOperator = useOptionalAuth()?.operator?.level !== "viewer";
  const [challenges, setChallenges] = useState<NodeScepChallenge[]>([]);
  const [status, setStatus] = useState<"error" | "loading" | "ready">("loading");
  const [loadError, setLoadError] = useState("");
  const [showMint, setShowMint] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<NodeScepChallenge | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    listNodeScepChallenges(nodeName)
      .then((result) => {
        if (cancelled) return;
        setChallenges(result);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(fleetErrorMessage(error, "Failed to load the node's SCEP challenges"));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [nodeName, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const columns: DataTableColumn<NodeScepChallenge>[] = [
    { cell: (c) => c.id, header: "ID", id: "id" },
    { cell: (c) => c.profile, header: "Profile", id: "profile" },
    {
      cell: (c) => (c.boundNames.length > 0 ? c.boundNames.join(", ") : "—"),
      header: "Bound names",
      id: "boundNames",
    },
    { cell: (c) => c.expiresAt.slice(0, 16).replace("T", " "), header: "Expires", id: "expiresAt" },
    { cell: (c) => c.createdByCn, header: "Minted by", id: "createdByCn" },
    {
      cell: (c) =>
        isOperator ? (
          <Button onClick={() => setRevokeTarget(c)} size="sm" variant="outline">
            Revoke
          </Button>
        ) : null,
      header: <span className="sr-only">Actions</span>,
      id: "actions",
      mobile: "action",
    },
  ];

  return (
    <div className="space-y-3">
      {isOperator ? (
        <div className="flex justify-end">
          <Button onClick={() => setShowMint(true)} size="sm">
            {"Mint challenge…"}
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        empty={
          <EmptyState
            body="No usable SCEP challenges."
            icon={IconCertificates}
            title="No challenges"
          />
        }
        error={
          <EmptyState
            body={loadError}
            icon={IconCertificates}
            title="Couldn't load the SCEP challenges"
            tone="danger"
          />
        }
        label="SCEP challenges"
        rowKey={(c) => c.id}
        rows={challenges}
        status={status}
      />

      {showMint ? (
        <MintNodeScepChallengeDialog
          nodeName={nodeName}
          onClose={() => setShowMint(false)}
          onMinted={() => {
            refresh();
          }}
        />
      ) : null}
      {revokeTarget ? (
        <RevokeNodeScepChallengeDialog
          challengeId={revokeTarget.id}
          nodeName={nodeName}
          onClose={() => setRevokeTarget(null)}
          onDone={() => {
            setRevokeTarget(null);
            refresh();
          }}
          profile={revokeTarget.profile}
        />
      ) : null}
    </div>
  );
};
