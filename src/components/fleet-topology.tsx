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

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { RootMark } from "@/components/root-mark";
import { useCertCounts } from "@/lib/certs";
import { type IdentityState } from "@/lib/mock";
import { useNodes } from "@/lib/nodes";
import { computeTreeLayout } from "@/lib/topology-layout";
import { cn } from "@/lib/utils";

// The topology viewBox. The whole graph is drawn in graph-space and framed by a
// camera (translate + scale) so the fleet can be larger than the viewport and be
// panned/zoomed. Aspect ratio is fixed; the svg scales to its container width.
const VIEW_W = 960;
const VIEW_H = 600;
const FIT_PAD = 48;
const MIN_K = 0.35;
const MAX_K = 2.6;
const FOCUS_K = 1.15;
// Focus-mode geometry: the ancestor chain is a straight horizontal line spaced
// by F_COL; the focused node's children fan out to the right spaced by F_ROW.
const F_COL = 210;
const F_ROW = 88;
// Spring dynamics for node motion — a floaty "2D space" settle (low stiffness,
// heavy damping so there is momentum but it comes to rest without ringing).
const SPRING_STIFF = 0.055;
const SPRING_DAMP = 0.8;
const OPACITY_EASE = 0.16;

const stateStroke: Record<IdentityState, string> = {
  AWAITING_CERT: "hsl(var(--warning))",
  ESTABLISHED: "hsl(var(--success))",
  REVOKED: "hsl(var(--destructive))",
};

const feedClass: Record<IdentityState, string> = {
  AWAITING_CERT: "feed-awaiting",
  ESTABLISHED: "feed-established",
  REVOKED: "feed-revoked",
};

interface Camera {
  k: number;
  tx: number;
  ty: number;
}

interface Motion {
  vx: number;
  vy: number;
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const prefersReducedMotion = (): boolean =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// A smooth curve from one circle center to another, bending horizontally. Drawn
// from live (animated) node centers so the connector flexes as the nodes move.
const edgePath = (from: { x: number; y: number }, to: { x: number; y: number }): string => {
  const mx = from.x + (to.x - from.x) * 0.5;
  return `M${from.x},${from.y} C${mx},${from.y} ${mx},${to.y} ${to.x},${to.y}`;
};

// Font size that keeps the issued count inside the circle regardless of digits.
const numberFont = (issued: number): number => {
  const digits = String(issued).length;
  if (digits <= 2) return 17;
  if (digits === 3) return 14;
  return 11;
};

export const FleetTopology = ({
  focus,
  onFocus,
  selected,
  singlePath = false,
}: {
  focus: null | string;
  onFocus: (name: string) => void;
  selected: string;
  // When true, focusing shows ONLY the node's path back to the Root (ancestor
  // chain, straight line) — no descendant fan. Used by the Nodes page.
  singlePath?: boolean;
}) => {
  // Per-node collapse. Default: nothing collapsed (expand all). Collapsing a
  // node hides its subtree and re-packs the tree; expand at will.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const liveNodes = useNodes();
  // NodeSummary carries no issued/revoked counts, so a live node arrives with
  // them defaulted to 0. Derive them from the certificates instead, which the
  // manager does report correctly (#85).
  const certCounts = useCertCounts();
  const allNodes = useMemo(
    () =>
      liveNodes.map((n) => {
        const counts = certCounts.get(n.name);

        return counts ? { ...n, issued: counts.issued, revoked: counts.revoked } : n;
      }),
    [liveNodes, certCounts],
  );
  const layout = useMemo(() => computeTreeLayout(allNodes, collapsed), [allNodes, collapsed]);
  const toggleCollapse = (name: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const fitCamera = useCallback((): Camera => {
    const { maxX, maxY, minX, minY } = layout.bounds;
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    const k = Math.min((VIEW_W - 2 * FIT_PAD) / w, (VIEW_H - 2 * FIT_PAD) / h, 1.4);
    return {
      k,
      tx: (VIEW_W - k * (minX + maxX)) / 2,
      ty: (VIEW_H - k * (minY + maxY)) / 2,
    };
  }, [layout]);

  const [camera, setCamera] = useState<Camera>(fitCamera);
  const [eased, setEased] = useState(true);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<null | SVGSVGElement>(null);
  const drag = useRef<{ ox: number; oy: number; tx: number; ty: number } | null>(null);

  const shownFocus = focus && layout.byName[focus] ? focus : null;

  // Focus layout: the ancestor chain (Root -> ... -> focused) on ONE straight
  // horizontal line, and (unless single-path) the focused node's children fanned
  // to the right. Overview keeps the tidy-tree positions.
  const focusPos = useMemo<null | Record<string, { x: number; y: number }>>(() => {
    if (!shownFocus) return null;
    const parentOf = new Map(layout.edges.map((e) => [e.to, e.from] as const));
    const chain: string[] = [shownFocus];
    let cur = shownFocus;
    while (parentOf.has(cur)) {
      cur = parentOf.get(cur) as string;
      chain.unshift(cur);
    }
    const m: Record<string, { x: number; y: number }> = {};
    for (const [i, name] of chain.entries()) {
      m[name] = { x: i * F_COL, y: 0 };
    }
    if (!singlePath) {
      const kids = layout.edges.filter((e) => e.from === shownFocus).map((e) => e.to);
      const kidX = chain.length * F_COL;
      const spread = (kids.length - 1) * F_ROW;
      for (const [i, name] of kids.entries()) {
        m[name] = { x: kidX, y: -spread / 2 + i * F_ROW };
      }
    }
    return m;
  }, [shownFocus, layout, singlePath]);

  // The nodes on screen: the focused node's lineage (ancestors + descendants, or
  // ancestors only in single-path), or the whole fleet in Overview.
  const visible = useMemo<null | Set<string>>(() => {
    if (!shownFocus) return null;
    const kids = new Map<string, string[]>();
    const parentOf = new Map<string, string>();
    for (const e of layout.edges) {
      parentOf.set(e.to, e.from);
      const arr = kids.get(e.from) ?? [];
      arr.push(e.to);
      kids.set(e.from, arr);
    }
    const set = new Set<string>([shownFocus]);
    let cur: string | undefined = shownFocus;
    while (cur && parentOf.has(cur)) {
      cur = parentOf.get(cur);
      if (cur) set.add(cur);
    }
    if (!singlePath) {
      const stack = [shownFocus];
      while (stack.length > 0) {
        const n = stack.pop() as string;
        for (const c of kids.get(n) ?? []) {
          set.add(c);
          stack.push(c);
        }
      }
    }
    return set;
  }, [shownFocus, layout, singlePath]);

  const visOf = useCallback((name: string): boolean => !visible || visible.has(name), [visible]);

  // Per-node targets (rest position + whether shown). Nodes spring toward these.
  const targets = useMemo(() => {
    const t = new Map<string, { vis: boolean; x: number; y: number }>();
    for (const p of layout.nodes) {
      const fp = focusPos?.[p.name];
      t.set(p.name, { vis: visOf(p.name), x: fp?.x ?? p.x, y: fp?.y ?? p.y });
    }
    return t;
  }, [layout, focusPos, visOf]);

  // Spring state lives in refs (mutated each animation frame); a reducer bump
  // re-renders so the svg reads the new positions/opacities.
  const posRef = useRef(new Map<string, Motion>());
  const opacityRef = useRef(new Map<string, number>());
  const targetsRef = useRef(targets);
  const rafRef = useRef<null | number>(null);
  const mounted = useRef(false);
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  const step = useCallback(() => {
    const t = targetsRef.current;
    let active = false;
    for (const [name, target] of t) {
      let p = posRef.current.get(name);
      if (!p) {
        p = { vx: 0, vy: 0, x: target.x, y: target.y };
        posRef.current.set(name, p);
      }
      const ax = (target.x - p.x) * SPRING_STIFF - p.vx * SPRING_DAMP;
      const ay = (target.y - p.y) * SPRING_STIFF - p.vy * SPRING_DAMP;
      p.vx += ax;
      p.vy += ay;
      p.x += p.vx;
      p.y += p.vy;
      if (
        Math.abs(target.x - p.x) > 0.4 ||
        Math.abs(target.y - p.y) > 0.4 ||
        Math.abs(p.vx) > 0.4 ||
        Math.abs(p.vy) > 0.4
      ) {
        active = true;
      } else {
        p.x = target.x;
        p.y = target.y;
        p.vx = 0;
        p.vy = 0;
      }
      const o = opacityRef.current.get(name) ?? 0;
      const to = target.vis ? 1 : 0;
      const no = o + (to - o) * OPACITY_EASE;
      if (Math.abs(to - no) > 0.01) {
        opacityRef.current.set(name, no);
        active = true;
      } else {
        opacityRef.current.set(name, to);
      }
    }
    rerender();
    rafRef.current = active ? requestAnimationFrame(step) : null;
  }, []);

  // Whenever targets change (focus / collapse / layout), kick the spring. First
  // mount and reduced-motion snap straight to rest.
  useEffect(() => {
    targetsRef.current = targets;
    const snap = () => {
      for (const [name, target] of targets) {
        posRef.current.set(name, { vx: 0, vy: 0, x: target.x, y: target.y });
        opacityRef.current.set(name, target.vis ? 1 : 0);
      }
      rerender();
    };
    if (!mounted.current) {
      mounted.current = true;
      snap();
      return;
    }
    if (prefersReducedMotion()) {
      snap();
      return;
    }
    // New nodes (e.g. from expanding) start at their target and fade in.
    for (const [name, target] of targets) {
      if (!posRef.current.has(name))
        posRef.current.set(name, { vx: 0, vy: 0, x: target.x, y: target.y });
      if (!opacityRef.current.has(name)) opacityRef.current.set(name, 0);
    }
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(step);
  }, [targets, step]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current ?? 0), []);

  // Center the camera on the focused node (eased); Overview eases to Fit.
  useEffect(() => {
    setEased(true);
    if (shownFocus && focusPos?.[shownFocus]) {
      const p = focusPos[shownFocus];
      setCamera({ k: FOCUS_K, tx: VIEW_W / 2 - FOCUS_K * p.x, ty: VIEW_H / 2 - FOCUS_K * p.y });
    } else {
      setCamera(fitCamera());
    }
  }, [shownFocus, focusPos, fitCamera]);

  const vbRatio = (): { rx: number; ry: number } => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { rx: 1, ry: 1 };
    return { rx: VIEW_W / rect.width, ry: VIEW_H / rect.height };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest("[data-node]")) return;
    setEased(false);
    setDragging(true);
    drag.current = { ox: e.clientX, oy: e.clientY, tx: camera.tx, ty: camera.ty };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const { rx, ry } = vbRatio();
    setCamera((c) => ({
      k: c.k,
      tx: d.tx + (e.clientX - d.ox) * rx,
      ty: d.ty + (e.clientY - d.oy) * ry,
    }));
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    setDragging(false);
    svgRef.current?.releasePointerCapture?.(e.pointerId);
  };

  // Zoom only on an explicit gesture. Claiming every wheel event merely
  // because the pointer is over the map meant scrolling the page past the
  // topology zoomed it out instead (#84). ctrl/cmd + wheel is the convention
  // from Figma and embedded maps, and trackpad pinch arrives as a wheel event
  // with ctrlKey already set, so pinch keeps working through the same check.
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    // Only now is the gesture ours, so only now suppress the browser's own
    // handling of it.
    e.preventDefault();

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { rx, ry } = vbRatio();
    const mx = (e.clientX - rect.left) * rx;
    const my = (e.clientY - rect.top) * ry;
    setEased(false);
    setCamera((c) => {
      const kNew = clamp(c.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12), MIN_K, MAX_K);
      return {
        k: kNew,
        tx: mx - (mx - c.tx) * (kNew / c.k),
        ty: my - (my - c.ty) * (kNew / c.k),
      };
    });
  };

  const posOf = (name: string, fx: number, fy: number): { x: number; y: number } =>
    posRef.current.get(name) ?? { x: fx, y: fy };
  const opOf = (name: string): number => opacityRef.current.get(name) ?? (visOf(name) ? 1 : 0);

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        <button
          className="rounded-md border bg-card px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:bg-secondary"
          onClick={() => {
            setEased(true);
            setCamera(fitCamera());
          }}
          type="button"
        >
          Fit
        </button>
      </div>

      <svg
        aria-label="CA fleet topology graph"
        className={cn("topo-canvas", dragging && "dragging")}
        onPointerCancel={endDrag}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onWheel={onWheel}
        ref={svgRef}
        role="img"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      >
        <g
          className={cn("topo-view", eased && "eased")}
          transform={`translate(${camera.tx},${camera.ty}) scale(${camera.k})`}
        >
          {/* connectors: rail + animated feeder, drawn from live node centers so
              they flex as the nodes spring around */}
          {layout.edges.map((edge) => {
            const base1 = layout.byName[edge.from];
            const base2 = layout.byName[edge.to];
            if (!base1 || !base2) return null;
            const o = Math.min(opOf(edge.from), opOf(edge.to));
            if (o < 0.02) return null;
            const from = posOf(edge.from, base1.x, base1.y);
            const to = posOf(edge.to, base2.x, base2.y);
            const d = edgePath(from, to);
            return (
              <g key={`${edge.from}->${edge.to}`} opacity={o}>
                <path className="rail" d={d} />
                <path className={cn("feed", feedClass[edge.state])} d={d} />
              </g>
            );
          })}

          {/* every CA as a circle; text lives in the node group, painted above
              the connectors (edges render first) */}
          {layout.nodes.map((p) => {
            const o = opOf(p.name);
            if (o < 0.02) return null;
            const pos = posOf(p.name, p.x, p.y);
            const isRoot = p.role === "root";
            const isSel = p.name === selected;
            const isFocused = p.name === shownFocus;
            const showNumber = !isRoot && (!shownFocus || isFocused);
            // Root stands out in Shield Blue; selected gets the secondary fill.
            let circleFill = "hsl(var(--card))";
            if (isRoot) circleFill = "hsl(var(--primary) / 0.15)";
            else if (isSel) circleFill = "hsl(var(--secondary))";
            let strokeW = 3;
            if (isFocused) strokeW = 5;
            else if (isRoot || isSel) strokeW = 4;
            return (
              <g
                aria-label={`${p.cn} (${p.state})`}
                aria-pressed={isSel}
                className="cursor-pointer"
                data-node={p.name}
                key={p.name}
                onClick={() => onFocus(p.name)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onFocus(p.name);
                  }
                }}
                opacity={o}
                role="button"
                tabIndex={0}
                transform={`translate(${pos.x},${pos.y})`}
              >
                <circle
                  fill={circleFill}
                  r={p.r}
                  stroke={isRoot ? "hsl(var(--primary))" : stateStroke[p.state]}
                  strokeWidth={strokeW}
                />
                {isRoot ? <RootMark /> : null}
                {showNumber ? (
                  <text
                    className="fill-foreground font-mono font-semibold"
                    dominantBaseline="central"
                    style={{ fontSize: numberFont(p.issued) }}
                    textAnchor="middle"
                    y={1}
                  >
                    {p.issued}
                  </text>
                ) : null}
                <text
                  className="fill-foreground font-mono"
                  style={{ fontSize: 11 }}
                  textAnchor="middle"
                  y={p.r + 16}
                >
                  {p.cn}
                </text>
                {p.hasChildren ? (
                  <g
                    onClick={(ev) => {
                      ev.stopPropagation();
                      toggleCollapse(p.name);
                    }}
                    transform={`translate(${p.r + 11},0)`}
                  >
                    <circle
                      fill="hsl(var(--card))"
                      r={8}
                      stroke="hsl(var(--border))"
                      strokeWidth={1.5}
                    />
                    <text
                      className="fill-foreground font-mono font-semibold"
                      dominantBaseline="central"
                      style={{ fontSize: 13 }}
                      textAnchor="middle"
                      y={1}
                    >
                      {p.collapsed ? "+" : "-"}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
