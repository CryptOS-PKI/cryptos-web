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

import type { LucideIcon } from "lucide-react";

import { ClipboardList, Network, Server } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

interface NavItem {
  end?: boolean;
  icon: LucideIcon;
  label: string;
  to: string;
}

const navItems: NavItem[] = [
  { end: true, icon: Network, label: "Fleet", to: "/" },
  { icon: Server, label: "Nodes", to: "/nodes" },
  { icon: ClipboardList, label: "Audit", to: "/audit" },
];

export const Sidebar = () => {
  return (
    <nav className="flex w-48 shrink-0 flex-col gap-1 border-r bg-card p-3">
      {navItems.map(({ end, icon: Icon, label, to }) => (
        <NavLink
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-3 py-2 font-mono text-sm transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )
          }
          end={end}
          key={to}
          to={to}
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
};
