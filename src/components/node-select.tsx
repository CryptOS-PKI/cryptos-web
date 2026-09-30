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

import { useEffect, useRef, useState } from "react";

import { IdentityBadge } from "@/components/identity-badge";
import { type NodeRole, roleLabels } from "@/lib/mock";
import { getNode, useNodes } from "@/lib/nodes";
import { cn } from "@/lib/utils";

// Nodes grouped by role in the dropdown, so the options read cleanly.
const GROUP_ORDER: NodeRole[] = ["root", "intermediate", "issuing"];
const GROUP_LABEL: Record<NodeRole, string> = {
  intermediate: "Intermediate CAs",
  issuing: "Issuing CAs",
  root: "Root",
};

// A custom select whose closed bar and open options show the node's identity
// (name, role/address, state badge) — the detail card's info in slim form.
export const NodeSelect = ({
  onSelect,
  selected,
}: {
  onSelect: (name: string) => void;
  selected: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const allNodes = useNodes();
  const current = getNode(selected) ?? allNodes[0];

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    globalThis.addEventListener("mousedown", onDocMouseDown);
    globalThis.addEventListener("keydown", onKey);
    return () => {
      globalThis.removeEventListener("mousedown", onDocMouseDown);
      globalThis.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-secondary"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-mono text-sm font-medium">{current.name}</span>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {roleLabels[current.role]}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <IdentityBadge state={current.identityState} />
          <span aria-hidden="true" className="font-mono text-xs text-muted-foreground">
            {"▾"}
          </span>
        </span>
      </button>

      {open ? (
        <div
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border bg-card shadow-xl"
          role="listbox"
        >
          {GROUP_ORDER.map((role) => {
            const group = allNodes.filter((n) => n.role === role);
            if (group.length === 0) return null;
            return (
              <div key={role}>
                <div className="sticky top-0 bg-secondary px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  {GROUP_LABEL[role]}
                </div>
                {group.map((n) => (
                  <button
                    aria-selected={n.name === selected}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-accent",
                      n.name === selected && "bg-secondary",
                    )}
                    key={n.name}
                    onClick={() => {
                      onSelect(n.name);
                      setOpen(false);
                    }}
                    role="option"
                    type="button"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-mono text-sm">{n.name}</span>
                      <span className="truncate font-mono text-[11px] text-muted-foreground">
                        {n.address}
                      </span>
                    </span>
                    <IdentityBadge state={n.identityState} />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
