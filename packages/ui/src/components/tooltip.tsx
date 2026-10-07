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

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";

import { cn } from "../lib/cn";

export interface TooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  side?: "bottom" | "left" | "right" | "top";
}

// Wrap the app once so every Tooltip shares one open/close delay.
export const TooltipProvider = TooltipPrimitive.Provider;

// Tooltip: content shown on hover and keyboard focus alike, linked to its
// trigger by aria-describedby. Built on @radix-ui/react-tooltip: its focus,
// hover-intent and aria wiring is tested upstream.
export const Tooltip = ({ children, content, side = "top" }: TooltipProps) => (
  <TooltipPrimitive.Root>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          "z-50 max-w-xs rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md",
        )}
        side={side}
        sideOffset={6}
      >
        {content}
        <TooltipPrimitive.Arrow className="fill-popover" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);
