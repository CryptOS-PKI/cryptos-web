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

import { useCallback, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { APPROVALS_CHANGED, listApprovals } from "@/lib/approvals";
import { cn } from "@/lib/utils";

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

const items: { end?: boolean; label: string; to: string }[] = [
  { end: true, label: "Dashboard", to: "/" },
  { label: "Fleet", to: "/fleet" },
  // Root sits before Nodes because that is the order the hierarchy reads, and
  // because /nodes deliberately excludes roots -- meeting Nodes first and
  // finding the root missing is what made this confusing (#86).
  { label: "Root", to: "/root" },
  { label: "Nodes", to: "/nodes" },
  { label: "Adopt", to: "/adopt" },
  { label: "Certificates", to: "/certificates" },
  { label: "Enrollment", to: "/enrollment" },
  { label: "Profiles", to: "/profiles" },
  { label: "Protocols", to: "/protocols" },
  { label: "Operator CAs", to: "/operator-cas" },
  { label: "Operators", to: "/operators" },
  { label: "Agent keys", to: "/agent-keys" },
  { label: "Approvals", to: "/approvals" },
  { label: "Audit", to: "/audit" },
];

export const TopNav = () => {
  const pending = usePendingApprovals();
  return (
    <nav className="flex items-center gap-1 border-b bg-card px-4">
      {items.map(({ end, label, to }) => (
        <NavLink
          className={({ isActive }) =>
            cn(
              "border-b-2 px-3 py-2.5 font-mono text-sm transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )
          }
          end={end}
          key={to}
          to={to}
        >
          {label}
          {to === "/approvals" && pending > 0 ? (
            <span
              aria-label={`${pending} pending approval${pending === 1 ? "" : "s"}`}
              className="ml-1.5 rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-semibold leading-none text-warning-foreground"
            >
              {pending}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
};
