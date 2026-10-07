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

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";

import { type IconComponent, IconDecommission } from "../icons";
import { cn } from "../lib/cn";

export interface DialogProps {
  children?: React.ReactNode;
  className?: string;
  /**
   * Close when the backdrop is clicked. Only for standard dialogs with no input:
   * destructive dialogs and anything holding typed text or a secret ignore it.
   */
  closeOnBackdrop?: boolean;
  /** Icon in the destructive dialog's red disc. */
  dangerIcon?: IconComponent;
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

const FIRST_FIELD =
  "input:not([disabled]):not([type='hidden']),select:not([disabled]),textarea:not([disabled])";

// Dialog is the modal: 480 px standard and destructive, 720 px wide, and a
// bottom sheet below 640 px. Focus moves in (the first field, or the element
// marked data-autofocus), Tab stays inside, Escape closes, and focus returns to
// the trigger when it closes. Built on @radix-ui/react-dialog: its focus,
// escape and aria handling is tested upstream.
export const Dialog = ({
  children,
  className,
  closeOnBackdrop = false,
  dangerIcon: DangerIcon = IconDecommission,
  description,
  footer,
  onClose,
  onEscape,
  open,
  title,
  variant = "standard",
}: DialogProps) => {
  const destructive = variant === "destructive";
  // Dialog has no Radix Trigger (it's driven by the `open` prop), so Radix's own
  // close-autofocus (which refocuses its Trigger, and runs a tick late besides)
  // has nothing to refocus. Capture whatever held focus before the dialog opened
  // in onOpenAutoFocus (it still runs synchronously, before focus moves) and
  // restore it synchronously here once `open` goes false.
  const returnFocusTo = React.useRef<HTMLElement | null>(null);
  const restoreFocus = React.useCallback(() => {
    returnFocusTo.current?.focus();
    // Clear it once restored so a dialog that unmounts later (already closed)
    // can't steal focus a second time.
    returnFocusTo.current = null;
  }, []);
  React.useEffect(() => {
    if (!open) restoreFocus();
  }, [open, restoreFocus]);
  // A parent that conditionally mounts an open Dialog removes it from the
  // tree without ever flipping `open` to false, so the effect above never
  // runs; this cleanup covers that unmount.
  React.useEffect(() => () => restoreFocus(), [restoreFocus]);

  return (
    <DialogPrimitive.Root
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/60"
          data-testid="dialog-backdrop"
          onClick={() => {
            if (closeOnBackdrop && !destructive) onClose();
          }}
        />
        <DialogPrimitive.Content
          aria-modal="true"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] w-full flex-col overflow-hidden border bg-card text-card-foreground shadow-2xl",
            "rounded-t-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl",
            variant === "wide" ? "sm:max-w-[720px]" : "sm:max-w-[480px]",
            className,
          )}
          data-variant={variant}
          onEscapeKeyDown={(event) => {
            if (onEscape) {
              event.preventDefault();
              onEscape();
            }
          }}
          // The overlay's own onClick decides whether a backdrop click closes
          // the dialog; Radix's pointerdown-based outside-dismiss would otherwise
          // run ahead of that check (and ignore it) on every real click.
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            returnFocusTo.current = document.activeElement as HTMLElement | null;
            const root = event.currentTarget as HTMLElement;
            const target =
              root.querySelector<HTMLElement>("[data-autofocus]") ??
              root.querySelector<HTMLElement>(FIRST_FIELD);
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
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
              <DialogPrimitive.Title className="text-lg font-semibold leading-tight">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="font-mono text-xs text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
            {children}
          </div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t px-5 py-3 max-sm:[&>*]:h-12 max-sm:[&>*]:flex-1">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
