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

import { IconChev, IconChevDown, IconEstablished, IconPending, IconRevoked } from "../icons";
import { cn } from "../lib/cn";
import { CryptosMark } from "./brand";

export type ChainStatus = "established" | "pending" | "revoked";

export interface TrustChainChipProps {
  current?: boolean;
  label: React.ReactNode;
  onClick?: () => void;
  role?: "root";
  status?: ChainStatus;
}

const chipTone: Record<"root" | ChainStatus, string> = {
  established: "border-success/40 bg-success/10",
  pending: "border-warning/40 bg-warning/10",
  revoked: "border-destructive/40 bg-destructive/10",
  root: "border-primary/40 bg-primary/10",
};

const currentText: Record<"root" | ChainStatus, string> = {
  established: "text-success",
  pending: "text-warning",
  revoked: "text-destructive",
  root: "text-primary",
};

const iconFor = (role?: "root", status?: ChainStatus) => {
  if (role === "root") return <CryptosMark className="text-foreground" size={14} />;
  if (status === "pending") return <IconPending className="size-3.5 text-warning" />;
  if (status === "revoked") return <IconRevoked className="size-3.5 text-destructive" />;
  return <IconEstablished className="size-3.5 text-success" />;
};

export const TrustChainChip = ({
  current = false,
  label,
  onClick,
  role,
  status = "established",
}: TrustChainChipProps) => {
  const classes = cn(
    "inline-flex h-7 w-fit items-center gap-1.5 rounded-md border px-2.5 font-mono text-xs",
    chipTone[role ?? status],
    current && "border-current font-bold",
    current && currentText[role ?? status],
  );
  const inner = (
    <>
      {iconFor(role, status)}
      <span className="text-foreground">{label}</span>
    </>
  );
  const attrs = {
    "aria-current": current ? ("true" as const) : undefined,
    "data-current": current ? "" : undefined,
    "data-status": role ?? status,
  };
  return onClick ? (
    <button
      className={cn(classes, "hover:brightness-110")}
      onClick={onClick}
      type="button"
      {...attrs}
    >
      {inner}
    </button>
  ) : (
    <span className={classes} {...attrs}>
      {inner}
    </span>
  );
};

export interface TrustChainItem extends Omit<TrustChainChipProps, "current"> {
  id: string;
}

// TrustChain draws root to node left to right; the last link is the current
// node. Vertical (phones) stacks the links with arrows pointing down.
export const TrustChain = ({
  className,
  items,
  label,
  orientation = "horizontal",
}: {
  className?: string;
  items: TrustChainItem[];
  label: string;
  orientation?: "horizontal" | "vertical";
}) => {
  const vertical = orientation === "vertical";
  return (
    <ul
      aria-label={label}
      className={cn(
        "flex gap-1.5",
        vertical ? "flex-col items-start" : "flex-wrap items-center",
        className,
      )}
      data-orientation={orientation}
    >
      {items.map(({ id, ...item }, index) => (
        <li
          className={cn("flex items-center gap-1.5", vertical && "flex-col items-start")}
          key={id}
        >
          {index > 0 ? (
            vertical ? (
              <IconChevDown className="ml-3 size-3.5 text-muted-foreground" />
            ) : (
              <IconChev className="size-3.5 text-muted-foreground" />
            )
          ) : null}
          <TrustChainChip {...item} current={index === items.length - 1} />
        </li>
      ))}
    </ul>
  );
};
