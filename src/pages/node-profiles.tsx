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

import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { getNodeConfig } from "@/lib/config";
import { fleetMode } from "@/lib/fleet/mode";
import { useNode } from "@/lib/nodes";
import { computeDrift, type DriftRow, type DriftStatus } from "@/lib/profile-drift";
import { applyProfileToNode, fromProtoProfile, useProfiles } from "@/lib/profiles";
import { cn } from "@/lib/utils";

const statusLabels: Record<DriftStatus, string> = {
  drifted: "Drifted",
  "in-sync": "In sync",
  "node-only": "Node only",
  "not-applied": "Not applied",
};

const statusTone: Record<DriftStatus, string> = {
  drifted: "text-warning",
  "in-sync": "text-success",
  "node-only": "text-muted-foreground",
  "not-applied": "text-muted-foreground",
};

// DriftView renders the live per-node drift. It fetches the node's full config,
// maps its pki.profiles[] onto the web shape, and compares against the catalog.
// A drifted or not-applied row offers an admin-gated "Apply catalog version"
// that calls ApplyProfileToNode and refetches; node-only rows are informational.
const DriftView = ({ nodeName }: { nodeName: string }) => {
  const { operator } = useAuth();
  const isAdmin = operator?.level === "admin";
  const catalog = useProfiles();

  const [rows, setRows] = useState<DriftRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [applyError, setApplyError] = useState("");
  const [pending, setPending] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const config = await getNodeConfig(nodeName);
      const nodeProfiles = (config.pki?.profiles ?? []).map((p) => fromProtoProfile(p));
      setRows(computeDrift(catalog, nodeProfiles));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load node config");
    }
  }, [catalog, nodeName]);

  useEffect(() => {
    void load();
  }, [load]);

  const reconcile = async (name: string) => {
    setApplyError("");
    setPending(name);
    try {
      await applyProfileToNode(nodeName, name);
      await load();
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "Apply failed");
    } finally {
      setPending("");
    }
  };

  if (loadError) {
    return (
      <p className="max-w-lg font-mono text-sm text-destructive" role="alert">
        {loadError}
      </p>
    );
  }
  if (!rows) {
    return <p className="max-w-lg font-mono text-sm text-muted-foreground">Loading drift…</p>;
  }

  return (
    <div className="space-y-3">
      {applyError ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {applyError}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="font-mono text-sm text-muted-foreground">No profiles to compare.</p>
      ) : null}
      {rows.map((row) => {
        const canReconcile = row.status === "drifted" || row.status === "not-applied";
        return (
          <div className="rounded-md border bg-card p-3" key={row.name}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{row.name}</span>
              <span className={cn("font-mono text-xs uppercase", statusTone[row.status])}>
                {statusLabels[row.status]}
              </span>
            </div>
            {row.fieldDiffs && row.fieldDiffs.length > 0 ? (
              <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
                {row.fieldDiffs.map((d) => (
                  <li key={d.field}>
                    {d.field}: catalog <span className="text-foreground">{d.catalog}</span> vs node{" "}
                    <span className="text-foreground">{d.node}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {canReconcile && isAdmin ? (
              <div className="mt-2">
                <Button
                  disabled={pending === row.name}
                  onClick={() => void reconcile(row.name)}
                  size="sm"
                  type="button"
                >
                  {pending === row.name ? "Applying…" : "Apply catalog version"}
                </Button>
              </div>
            ) : null}
            {canReconcile && !isAdmin ? (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Reconcile requires admin level.
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export const NodeProfilesPage = () => {
  const { name } = useParams<{ name: string }>();
  const node = useNode(name);

  if (!node) {
    return <Navigate replace to={`/nodes/${name}`} />;
  }

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Profile drift</h1>
        <p className="font-mono text-sm text-muted-foreground">{node.name}</p>
      </div>

      {fleetMode() === "mock" ? (
        <p className="max-w-lg font-mono text-sm text-muted-foreground">
          Drift is computed live against a node&apos;s applied config; switch to a live data source
          to compare this node against the catalog.
        </p>
      ) : (
        <DriftView nodeName={node.name} />
      )}

      <Button asChild variant="outline">
        <Link to={`/nodes/${node.name}`}>Back to node</Link>
      </Button>
    </section>
  );
};
