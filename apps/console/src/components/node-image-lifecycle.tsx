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
  EmptyState,
  FieldTile,
  FieldTiles,
  IconCertificates,
  StatusBadge,
} from "@cryptos-pki/ui";
import { useEffect, useState } from "react";

import { ActivateNodeImageDialog } from "@/components/activate-node-image-dialog";
import { RollbackNodeImageDialog } from "@/components/rollback-node-image-dialog";
import { StageNodeImageDialog } from "@/components/stage-node-image-dialog";
import { useOptionalAuth } from "@/context/auth";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { getNodeImageStatus, type NodeImageStatus } from "@/lib/node-image";

const shortHash = (hash: string) => (hash ? hash.slice(0, 12) : "—");

// NodeImageLifecycle brings `cryptosctl image status/stage/rollback/activate`
// onto node detail. Status is readable by any level; staging, activating and
// rolling back are admin-only, the node's own write paths.
export const NodeImageLifecycle = ({ caCn, nodeName }: { caCn: string; nodeName: string }) => {
  const isAdmin = useOptionalAuth()?.operator?.level === "admin";
  const [status, setStatus] = useState<NodeImageStatus | null>(null);
  const [state, setState] = useState<"error" | "loading" | "ready">("loading");
  const [loadError, setLoadError] = useState("");
  const [dialog, setDialog] = useState<"activate" | "rollback" | "stage" | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    getNodeImageStatus(nodeName)
      .then((result) => {
        if (cancelled) return;
        setStatus(result);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(fleetErrorMessage(error, "Failed to load the node's image status"));
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [nodeName, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  if (state === "error") {
    return (
      <EmptyState
        body={loadError}
        icon={IconCertificates}
        title="Couldn't load the image status"
        tone="danger"
      />
    );
  }

  if (state === "loading" || !status) {
    return <p className="font-mono text-xs text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-3">
      <FieldTiles columns={2}>
        <FieldTile
          label="running"
          mono
          value={`${shortHash(status.runningSha256)} · ${status.runningVersion}`}
        />
        <FieldTile
          label="active (next boot)"
          mono
          value={
            status.rebootPending ? (
              <span className="flex items-center gap-1.5">
                {shortHash(status.activeSha256)}
                <StatusBadge status="drifted">Reboot pending</StatusBadge>
              </span>
            ) : (
              shortHash(status.activeSha256)
            )
          }
        />
        <FieldTile
          full
          label="previous (rollback target)"
          mono
          value={shortHash(status.previousSha256)}
        />
      </FieldTiles>

      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialog("stage")} size="sm" variant="outline">
            {"Stage image…"}
          </Button>
          <Button
            disabled={!status.rebootPending}
            onClick={() => setDialog("activate")}
            size="sm"
            variant={status.rebootPending ? "default" : "outline"}
          >
            {"Activate image…"}
          </Button>
          <Button
            disabled={!status.previousSha256}
            onClick={() => setDialog("rollback")}
            size="sm"
            variant="outline"
          >
            {"Roll back…"}
          </Button>
        </div>
      ) : null}

      {dialog === "stage" ? (
        <StageNodeImageDialog
          nodeName={nodeName}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      ) : null}
      {dialog === "activate" ? (
        <ActivateNodeImageDialog
          caCn={caCn}
          nodeName={nodeName}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      ) : null}
      {dialog === "rollback" ? (
        <RollbackNodeImageDialog
          nodeName={nodeName}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
};
