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

import { Link } from "react-router-dom";

import { DiagnosticsCopy } from "@/components/layout/diagnostics-copy";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Wordmark } from "@/components/layout/wordmark";
import { useAuth } from "@/context/auth";

export const Header = () => {
  const { operator } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <Link
        className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
        to="/"
      >
        <Wordmark />
      </Link>
      <div className="flex items-center gap-3">
        {operator ? (
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            {operator.commonName}
          </span>
        ) : null}
        {/* In the shell too, so a report can be produced from whatever page the
            problem is actually on (#83). */}
        <DiagnosticsCopy />
        <ThemeToggle />
      </div>
    </header>
  );
};
