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

import { useEffect, useState } from "react";

import { FleetTopology } from "@/components/fleet-topology";
import { NodeDetailPanel } from "@/components/node-detail-panel";
import { NodeSelect } from "@/components/node-select";
import { mockNodes } from "@/lib/mock";
import { getNode, useNodes } from "@/lib/nodes";

const PanelHeader = ({ children, label }: { children?: React.ReactNode; label: string }) => {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
};

const Legend = () => {
  return (
    <div className="flex gap-3 font-mono text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <i className="h-2 w-2 rounded-full bg-success" />
        Established
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="h-2 w-2 rounded-full bg-warning" />
        Pending
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="h-2 w-2 rounded-full bg-destructive" />
        Revoked
      </span>
    </div>
  );
};

// The default selection is the first established intermediate. Falls back to the
// first node.
const defaultSelected =
  mockNodes.find((n) => n.role === "intermediate" && n.identityState === "ESTABLISHED")?.name ??
  mockNodes[0].name;

// Shared topology surface used by both the Fleet page (full neighbourhood on
// focus) and the Nodes page (single path to the Root on focus).
export const TopologyExplorer = ({
  singlePath = false,
  title,
  withList = false,
}: {
  singlePath?: boolean;
  title: string;
  withList?: boolean;
}) => {
  const [selected, setSelected] = useState(defaultSelected);
  const [focus, setFocus] = useState<null | string>(null);
  const allNodes = useNodes();
  const rootCount = allNodes.filter((n) => n.role === "root").length;
  // Cold load in `live`/`live-auth` mode: ListNodes hasn't resolved yet, so
  // allNodes is empty and neither the selected name nor allNodes[0] resolves
  // to a node. Stay undefined here (never mockNodes[0]) and render a loading
  // state below rather than dereference it.
  const node = getNode(selected) ?? allNodes[0];

  const action = singlePath
    ? "click a node to trace its path to the Root"
    : "click a node to center it · drag to pan · ctrl+scroll to zoom";

  // Clicking a node selects it (detail panel) and centers on it. The Root is
  // not a focus target, and clicking the already-focused node toggles back —
  // both return to the whole-fleet Overview.
  const handleFocus = (name: string) => {
    setSelected(name);
    setFocus(getNode(name)?.role === "root" || name === focus ? null : name);
  };

  // Esc leaves focus and returns to the overview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocus(null);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {rootCount} Root · {allNodes.length} nodes · {action}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {withList ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Node
            </span>
            <NodeSelect onSelect={handleFocus} selected={selected} />
          </div>
        ) : null}

        <div className="w-full rounded-xl border bg-card">
          <PanelHeader label="Topology">
            {focus ? (
              <button
                className="rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:bg-secondary"
                onClick={() => setFocus(null)}
                type="button"
              >
                Overview
              </button>
            ) : (
              <Legend />
            )}
          </PanelHeader>
          <FleetTopology
            focus={focus}
            onFocus={handleFocus}
            selected={selected}
            singlePath={singlePath}
          />
        </div>

        <div className="w-full rounded-xl border bg-card">
          {node ? (
            <>
              <PanelHeader label={`Node · ${node.name}`} />
              <NodeDetailPanel node={node} />
            </>
          ) : (
            <>
              <PanelHeader label="Node" />
              <p className="p-4 text-sm text-muted-foreground">
                {allNodes.length === 0 ? "Loading fleet\u2026" : "No nodes."}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
