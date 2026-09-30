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

import { type IdentityState, type Node, type NodeRole } from "@/lib/mock";

// A tidy left-to-right tree layout for the whole CA fleet. Every CA is a circle;
// the pan/zoom canvas handles scale and a node's subtree can be collapsed. Depth
// sets the column (Root -> intermediates -> issuing), and each subtree is given a
// vertical band so siblings never overlap. Coordinates are in an abstract graph
// space; the view fits/pans/zooms over the computed bounds.

/** A CA placed at graph-space coordinates. */
export interface Placed {
  cn: string;
  collapsed: boolean;
  hasChildren: boolean;
  issued: number;
  name: string;
  r: number;
  role: NodeRole;
  state: IdentityState;
  x: number;
  y: number;
}

/** A parent -> child trust edge, keyed by node name, colored by the child state. */
export interface Edge {
  from: string;
  state: IdentityState;
  to: string;
}

/** Bounding box of all placed nodes (before padding). */
export interface Bounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export interface TreeLayout {
  bounds: Bounds;
  byName: Record<string, Placed>;
  edges: Edge[];
  nodes: Placed[];
}

const COL = 260;
const ROW = 92;
const ROOT_R = 34;
const NODE_R = 27;

// Radius is consistent so a small issued count (18) reads the same as a large one
// (142); only the Root is a touch larger as the anchor.
const radiusFor = (role: NodeRole): number => (role === "root" ? ROOT_R : NODE_R);

export const computeTreeLayout = (
  nodes: Node[],
  collapsed: Set<string> = new Set(),
): TreeLayout => {
  // Build a parent-CN -> children index from the passed nodes so that nodes
  // added at runtime (e.g. via addNode after enrollment approval) are visible to
  // the layout recursion. This replaces the static childrenOf() import from mock.
  const childrenByParentCn = new Map<string, Node[]>();
  for (const n of nodes) {
    if (!n.parentCn) continue;
    const arr = childrenByParentCn.get(n.parentCn) ?? [];
    arr.push(n);
    childrenByParentCn.set(n.parentCn, arr);
  }
  const childOf = (cn: string): Node[] => childrenByParentCn.get(cn) ?? [];

  // Descendants of a collapsed node are hidden and excluded from the layout, so
  // the tree re-packs tightly around what remains.
  const hidden = new Set<string>();
  const markHidden = (cn: string): void => {
    for (const c of childOf(cn)) {
      hidden.add(c.name);
      markHidden(c.cn);
    }
  };
  for (const name of collapsed) {
    const node = nodes.find((n) => n.name === name);
    if (node) markHidden(node.cn);
  }
  const shown = nodes.filter((n) => !hidden.has(n.name));

  // Effective children: a collapsed node lays out as a leaf.
  const kidsOf = (node: Node): Node[] =>
    collapsed.has(node.name) ? [] : childOf(node.cn).filter((c) => !hidden.has(c.name));

  const roots = shown.filter((n) => !n.parentCn);
  const yByName = new Map<string, number>();
  let leafCursor = 0;

  // Post-order: a leaf takes the next row; a parent centers on its children.
  const assignY = (node: Node): number => {
    const kids = kidsOf(node);
    let y: number;
    if (kids.length === 0) {
      y = leafCursor * ROW;
      leafCursor += 1;
    } else {
      const kidYs = kids.map((k) => assignY(k));
      y = kidYs.reduce((a, b) => a + b, 0) / kidYs.length;
    }
    yByName.set(node.name, y);
    return y;
  };
  for (const r of roots) assignY(r);

  const depthByName = new Map<string, number>();
  const setDepth = (node: Node, depth: number): void => {
    depthByName.set(node.name, depth);
    for (const k of kidsOf(node)) setDepth(k, depth + 1);
  };
  for (const r of roots) setDepth(r, 0);

  const placed: Placed[] = shown.map((n) => ({
    cn: n.cn,
    collapsed: collapsed.has(n.name),
    hasChildren: childOf(n.cn).length > 0,
    issued: n.issued,
    name: n.name,
    r: radiusFor(n.role),
    role: n.role,
    state: n.identityState,
    x: (depthByName.get(n.name) ?? 0) * COL,
    y: yByName.get(n.name) ?? 0,
  }));

  const byName: Record<string, Placed> = {};
  for (const p of placed) byName[p.name] = p;

  const edges: Edge[] = [];
  for (const n of shown) {
    if (!n.parentCn) continue;
    const parent = shown.find((p) => p.cn === n.parentCn);
    if (parent) edges.push({ from: parent.name, state: n.identityState, to: n.name });
  }

  const xs = placed.map((p) => p.x);
  const ys = placed.map((p) => p.y);
  const bounds: Bounds = {
    maxX: Math.max(...xs) + NODE_R,
    maxY: Math.max(...ys) + NODE_R,
    minX: Math.min(...xs) - NODE_R,
    minY: Math.min(...ys) - NODE_R,
  };

  return { bounds, byName, edges, nodes: placed };
};
