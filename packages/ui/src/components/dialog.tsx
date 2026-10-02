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

import { type LucideIcon, Trash2 } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn";
import { useFocusTrap } from "../lib/focus-trap";

export interface DialogProps {
  children?: React.ReactNode;
  className?: string;
  /**
   * Close when the backdrop is clicked. Only for standard dialogs with no input:
   * destructive dialogs and anything holding typed text or a secret ignore it.
   */
  closeOnBackdrop?: boolean;
  /** Icon in the destructive dialog's red disc. */
  dangerIcon?: LucideIcon;
  description?: React.ReactNode;
  /** The actions row, pinned to the bottom (48 px targets on phones). */
  footer?: React.ReactNode;
  onClose: () => void;
  /** Handle Escape yourself (to ask before closing, say) instead of closing. */
  onEscape?: () => void;
  open: boolean;
  title: React.ReactNode;
  variant?: "destructive" | "standard" | "wide";
}

// Dialog is the modal: 480 px standard and destructive, 720 px wide, and a
// bottom sheet below 640 px. Focus moves in (the first field, or the element
// marked data-autofocus), Tab stays inside, Escape closes, and focus returns to
// the trigger when it closes.
export const Dialog = ({
  children,
  className,
  closeOnBackdrop = false,
  dangerIcon: DangerIcon = Trash2,
  description,
  footer,
  onClose,
  onEscape,
  open,
  title,
  variant = "standard",
}: DialogProps) => {
  const panel = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  useFocusTrap(panel, open);

  if (!open) return null;
  const destructive = variant === "destructive";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      data-testid="dialog-backdrop"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          "flex max-h-[92vh] w-full flex-col overflow-hidden border bg-card text-card-foreground shadow-2xl",
          "rounded-t-xl sm:rounded-xl",
          variant === "wide" ? "sm:max-w-[720px]" : "sm:max-w-[480px]",
          className,
        )}
        data-variant={variant}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          if (onEscape) onEscape();
          else onClose();
        }}
        ref={panel}
        role="dialog"
        tabIndex={-1}
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden"
        />
        <div className="flex gap-3 px-5 pt-5">
          {destructive ? (
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive"
              data-testid="dialog-danger-icon"
            >
              <DangerIcon className="size-4" />
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold leading-tight" id={titleId}>
              {title}
            </h2>
            {description ? (
              <div className="font-mono text-xs text-muted-foreground" id={descriptionId}>
                {description}
              </div>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t px-5 py-3 max-sm:[&>*]:h-12 max-sm:[&>*]:flex-1">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};
