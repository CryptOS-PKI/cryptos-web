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

import * as React from "react";

import { cn } from "../lib/cn";

export type IconComponent = (props: IconProps) => React.JSX.Element;
export interface IconProps { className?: string; size?: 16 | 20 | 24; title?: string }

export const IconBase = ({ children, className, size = 20, title }: { children: React.ReactNode } & IconProps) => (
  <svg
    aria-hidden={title ? undefined : true}
    className={cn("shrink-0", className)}
    fill="none" height={size} role={title ? "img" : undefined}
    stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
    viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg"
  >
    {title ? <title>{title}</title> : null}
    {children}
  </svg>
);
