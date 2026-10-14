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

import type { IconComponent } from "@cryptos-pki/ui";

import {
  Badge,
  IconAdopt,
  IconAgentKeys,
  IconApprovals,
  IconAudit,
  IconCertificates,
  IconDashboard,
  IconEnrollment,
  IconFleet,
  IconLevel,
  IconNodes,
  IconOperatorCAs,
  IconOperators,
  IconProfiles,
  IconProtocols,
  IconRoot,
  NavItem,
  NavSection,
  AppShell as Shell,
  ThemeToggle,
  Wordmark,
} from "@cryptos-pki/ui";
import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import type { OperatorLevel } from "@/context/auth";

import { DiagnosticsCopy } from "@/components/layout/diagnostics-copy";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { APPROVALS_CHANGED, listApprovals } from "@/lib/approvals";

// New step-up requests arrive without any action in this tab, so the count is
// also refreshed on a slow timer, on every navigation, and after a decision.
const PENDING_REFRESH_MS = 30_000;

const usePendingApprovals = (): number => {
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    listApprovals({ status: "pending" })
      .then((rows) => setCount(rows.length))
      .catch(() => setCount(0));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const timer = setInterval(refresh, PENDING_REFRESH_MS);
    globalThis.addEventListener(APPROVALS_CHANGED, refresh);
    return () => {
      clearInterval(timer);
      globalThis.removeEventListener(APPROVALS_CHANGED, refresh);
    };
  }, [refresh]);

  return count;
};

interface NavGroup {
  items: NavLeaf[];
  label?: string;
}

interface NavLeaf {
  end?: boolean;
  icon: IconComponent;
  label: string;
  /** Why an operator below this level can't use the page; undefined unlocks it. */
  needs?: OperatorLevel;
  to: string;
}

// The grouping and the headings follow the FleetOS Console prototype; the
// order within each group is the console's existing order (unchanged).
const NAV_GROUPS: NavGroup[] = [
  { items: [{ end: true, icon: IconDashboard, label: "Dashboard", to: "/" }] },
  {
    items: [
      { icon: IconFleet, label: "Fleet", to: "/fleet" },
      { icon: IconRoot, label: "Root", to: "/root" },
      { icon: IconNodes, label: "Nodes", to: "/nodes" },
      { icon: IconAdopt, label: "Adopt", needs: "admin", to: "/adopt" },
    ],
    label: "FLEET",
  },
  {
    items: [
      { icon: IconCertificates, label: "Certificates", to: "/certificates" },
      { icon: IconEnrollment, label: "Enrollment", to: "/enrollment" },
      { icon: IconProfiles, label: "Profiles", to: "/profiles" },
      { icon: IconProtocols, label: "Protocols", to: "/protocols" },
    ],
    label: "CERTIFICATES",
  },
  {
    items: [
      { icon: IconOperatorCAs, label: "Operator CAs", to: "/operator-cas" },
      { icon: IconOperators, label: "Operators", to: "/operators" },
      { icon: IconAgentKeys, label: "Agent keys", to: "/agent-keys" },
      { icon: IconApprovals, label: "Approvals", to: "/approvals" },
    ],
    label: "ACCESS",
  },
  { items: [{ icon: IconAudit, label: "Audit", to: "/audit" }], label: "ACTIVITY" },
];

// Mirrors react-router's own NavLink matching, so highlighting the active item
// changes nothing about which route is considered current.
const isCurrent = (pathname: string, to: string, end?: boolean): boolean =>
  end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

const LEVEL_BADGE_VARIANT: Record<OperatorLevel, "outline" | "tag-primary" | "tag"> = {
  admin: "tag-primary",
  operator: "tag",
  viewer: "outline",
};

const rankOf: Record<OperatorLevel, number> = { admin: 2, operator: 1, viewer: 0 };

const lockedReason = (
  needs: OperatorLevel | undefined,
  level: OperatorLevel,
): string | undefined =>
  needs && rankOf[level] < rankOf[needs] ? `Needs ${needs} level` : undefined;

const Banner = () => (
  <div className="flex h-8 shrink-0 items-center gap-2.5 border-b border-warning/40 bg-warning/10 px-5 text-[12.5px]">
    <span className="rounded bg-warning px-1.5 py-px font-mono text-[10.5px] font-bold tracking-[0.06em] text-warning-foreground">
      PRE-1.0
    </span>
    <span>CryptOS is pre-1.0: until v1.0.0, any release may change fundamentally.</span>
  </div>
);

export const AppShell = () => {
  const { operator } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const pending = usePendingApprovals();
  const level = operator?.level ?? "viewer";

  const brand = (
    <Link
      className="rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      to="/"
    >
      <Wordmark product="FleetOS" />
    </Link>
  );

  const nav = (
    <>
      {NAV_GROUPS.map((group) => (
        <NavSection key={group.label ?? "root"} label={group.label}>
          {group.items.map(({ end, icon, label, needs, to }) => (
            <NavItem
              active={isCurrent(pathname, to, end)}
              asChild
              badge={to === "/approvals" ? pending || undefined : undefined}
              badgeLabel={
                to === "/approvals"
                  ? `${pending} pending approval${pending === 1 ? "" : "s"}`
                  : undefined
              }
              icon={icon}
              key={to}
              label={label}
              locked={lockedReason(needs, level)}
            >
              <NavLink end={end} to={to} />
            </NavItem>
          ))}
        </NavSection>
      ))}
    </>
  );

  const topBar = (
    <>
      {operator ? (
        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
          {operator.commonName}
        </span>
      ) : null}
      {operator ? (
        <Badge className="gap-1 uppercase" variant={LEVEL_BADGE_VARIANT[operator.level]}>
          <IconLevel className="size-3" />
          {operator.level}
        </Badge>
      ) : null}
      <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:inline-block" />
      {/* In the shell too, so a report can be produced from whatever page the
          problem is actually on (#83). */}
      <DiagnosticsCopy />
      <ThemeToggle onToggle={toggleTheme} theme={theme} />
    </>
  );

  return (
    <Shell banner={<Banner />} brand={brand} nav={nav} navFooter="FleetOS" topBar={topBar}>
      <Outlet />
    </Shell>
  );
};
