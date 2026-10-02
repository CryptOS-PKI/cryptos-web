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

import { CircleAlert, CircleCheck, Info, type LucideIcon, TriangleAlert } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn";

export type NoticeTone = "danger" | "info" | "success" | "warning";

const TONES: Record<NoticeTone, { box: string; icon: LucideIcon; role: string; text: string }> = {
  danger: {
    box: "border-destructive/40 border-l-destructive bg-destructive/10",
    icon: CircleAlert,
    role: "alert",
    text: "text-destructive",
  },
  info: {
    box: "border-primary/40 border-l-primary bg-primary/10",
    icon: Info,
    role: "note",
    text: "text-primary",
  },
  success: {
    box: "border-success/40 border-l-success bg-success/10",
    icon: CircleCheck,
    role: "status",
    text: "text-success",
  },
  warning: {
    box: "border-warning/40 border-l-warning bg-warning/10",
    icon: TriangleAlert,
    role: "note",
    text: "text-warning",
  },
};

export interface NoticeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  action?: React.ReactNode;
  title?: React.ReactNode;
  tone?: NoticeTone;
}

// Notice is the callout: a 10% tone fill, a 40% tone border and a 4 px edge,
// the same pattern as the docs callouts.
export const Notice = ({
  action,
  children,
  className,
  role,
  title,
  tone = "info",
  ...props
}: NoticeProps) => {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-md border border-l-4 px-3.5 py-3 text-[13px]",
        t.box,
        className,
      )}
      data-tone={tone}
      role={role ?? t.role}
      {...props}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", t.text)} />
      <div className="min-w-0 flex-1 space-y-0.5 leading-relaxed">
        {title ? <p className={cn("font-semibold", t.text)}>{title}</p> : null}
        {children ? <div className="text-foreground">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
};
