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

import { type IconComponent, IconDanger, IconInfo, IconSuccess, IconWarning } from "../icons";
import { cn } from "../lib/cn";

export type NoticeTone = "danger" | "info" | "success" | "warning";

// The tone's 10%-tint fill failed WCAG AA for its own text in the light
// theme (a saturated warning or info text on its own pale tint lands around
// 2.8:1 to 4.2:1, short of the 4.5:1 normal-text minimum). The box now sits
// on the card background, which is already the app's body-text pairing, and
// the tone shows only on the left edge and the icon (both checked against
// bg-card at 3:1 or better in light and dark, the non-text minimum): no
// combination depends on tone-colored text to be readable.
const TONES: Record<NoticeTone, { box: string; icon: IconComponent; role: string; text: string }> =
  {
    danger: {
      box: "border-border border-l-destructive bg-card",
      icon: IconDanger,
      role: "alert",
      text: "text-destructive",
    },
    info: {
      box: "border-border border-l-primary bg-card",
      icon: IconInfo,
      role: "note",
      text: "text-primary",
    },
    success: {
      box: "border-border border-l-success bg-card",
      icon: IconSuccess,
      role: "status",
      text: "text-success",
    },
    warning: {
      box: "border-border border-l-warning bg-card",
      icon: IconWarning,
      role: "note",
      text: "text-warning",
    },
  };

export interface NoticeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  action?: React.ReactNode;
  title?: React.ReactNode;
  tone?: NoticeTone;
}

// Notice is the callout: the card background, a 4 px tone edge and a
// tone-colored icon, full width of whatever it is placed in. Title and body
// always read in the foreground color, so the tone never has to carry
// contrast on its own.
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
        "flex w-full gap-3 rounded-md border border-l-4 px-3.5 py-3 text-[13px]",
        t.box,
        className,
      )}
      data-tone={tone}
      role={role ?? t.role}
      {...props}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", t.text)} />
      <div className="min-w-0 flex-1 space-y-0.5 leading-relaxed">
        {title ? <p className="font-semibold text-foreground">{title}</p> : null}
        {children ? <div className="text-foreground">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
};
