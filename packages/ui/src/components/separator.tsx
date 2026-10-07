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

import { cn } from "../lib/cn";

export const Separator = ({
  className,
  decorative = false,
  orientation = "horizontal",
}: {
  className?: string;
  decorative?: boolean;
  orientation?: "horizontal" | "vertical";
}) => (
  <div
    aria-orientation={decorative ? undefined : orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className,
    )}
    role={decorative ? "none" : "separator"}
  />
);
