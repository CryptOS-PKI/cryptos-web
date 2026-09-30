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

import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

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
  { label: "Operators", to: "/operators" },
  { label: "Agent keys", to: "/agent-keys" },
  { label: "Audit", to: "/audit" },
];

export const TopNav = () => {
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
        </NavLink>
      ))}
    </nav>
  );
};
