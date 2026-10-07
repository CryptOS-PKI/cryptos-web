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

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import {
  IconApprove,
  type IconComponent,
  IconDanger,
  IconDeny,
  IconEstablished,
  IconExpiring,
  IconInfo,
  IconPending,
  IconRevoked,
  IconValid,
  IconWarning,
} from "../icons";
import { cn } from "../lib/cn";

// Kind, level and role badges are square-cornered mono tags; state badges are
// pills with a shape icon (StatusBadge), so a state is never mistaken for a type.
export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap border font-mono transition-colors",
  {
    defaultVariants: {
      variant: "tag",
    },
    variants: {
      variant: {
        default: "rounded-full border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary",
        destructive:
          "rounded-full border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs text-destructive",
        outline: "rounded-full border-border px-2 py-0.5 text-xs text-foreground",
        secondary:
          "rounded-full border-transparent bg-secondary px-2 py-0.5 text-xs text-secondary-foreground",
        success: "rounded-full border-success/40 bg-success/10 px-2 py-0.5 text-xs text-success",
        tag: "h-5 rounded border-border bg-transparent px-1.5 text-[11px] text-foreground",
        "tag-primary":
          "h-5 rounded border-primary/40 bg-primary/10 px-1.5 text-[11px] font-medium text-primary",
        warning: "rounded-full border-warning/40 bg-warning/10 px-2 py-0.5 text-xs text-warning",
      },
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);

type Tone = "danger" | "muted" | "primary" | "success" | "warning";

// Every state the console shows, with its tone and shape. The shapes differ
// (filled dot, open circle, clock, exclamation, slash) so a state never relies
// on colour alone.
const STATUS = {
  active: ["success", IconValid],
  approved: ["success", IconApprove],
  denied: ["danger", IconDeny],
  drifted: ["warning", IconWarning],
  error: ["danger", IconDanger],
  established: ["success", IconEstablished],
  expired: ["danger", IconDanger],
  expiring: ["warning", IconExpiring],
  "in-sync": ["success", IconApprove],
  info: ["primary", IconInfo],
  muted: ["muted", IconPending],
  ok: ["success", IconApprove],
  pending: ["warning", IconPending],
  rejected: ["danger", IconDeny],
  retired: ["muted", IconDeny],
  retiring: ["warning", IconExpiring],
  revoked: ["danger", IconRevoked],
  used: ["muted", IconEstablished],
  valid: ["success", IconValid],
} as const satisfies Record<string, readonly [Tone, IconComponent]>;

export type Status = keyof typeof STATUS;

// In the light theme the word is set in the foreground colour beside the
// coloured shape: the success and warning hues don't reach AA as small text on
// white. The dark theme colours the word too.
const toneClasses: Record<Tone, string> = {
  danger: "border-destructive/40 bg-destructive/10 text-foreground dark:text-destructive",
  muted: "border-border bg-transparent text-muted-foreground",
  primary: "border-primary/40 bg-primary/10 text-foreground dark:text-primary",
  success: "border-success/40 bg-success/10 text-foreground dark:text-success",
  warning: "border-warning/40 bg-warning/10 text-foreground dark:text-warning",
};

const iconTone: Record<Tone, string> = {
  danger: "text-destructive",
  muted: "text-muted-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: Status;
}

export const StatusBadge = ({ children, className, status, ...props }: StatusBadgeProps) => {
  const [tone, Icon] = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      data-status={status}
      {...props}
    >
      <Icon className={cn("size-3 shrink-0", iconTone[tone])} />
      <span>{children ?? status}</span>
    </span>
  );
};
