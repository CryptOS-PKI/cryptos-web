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

import { Moon, Sun } from "lucide-react";

import { cn } from "../lib/cn";

export const ThemeToggle = ({
  className,
  onToggle,
  theme,
}: {
  className?: string;
  onToggle: () => void;
  theme: "dark" | "light";
}) => {
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button
      aria-label={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-md border text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      onClick={onToggle}
      title={label}
      type="button"
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" className="size-4" />
      ) : (
        <Moon aria-hidden="true" className="size-4" />
      )}
    </button>
  );
};
