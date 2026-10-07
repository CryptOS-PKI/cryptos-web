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

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { IconLock } from "../icons";
import { cn } from "../lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:bg-muted aria-disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 px-3.5",
        icon: "size-8 p-0",
        lg: "h-10 px-5",
        sm: "h-8 px-3 text-[13px]",
        touch: "h-12 px-5 text-[15px]",
      },
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        dev: "border border-dashed border-muted-foreground/60 bg-transparent font-mono text-xs text-muted-foreground hover:text-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        "ghost-danger":
          "bg-transparent text-destructive hover:bg-destructive/10 aria-disabled:bg-transparent",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-secondary aria-disabled:bg-transparent",
        "outline-danger":
          "border border-destructive/50 bg-transparent text-destructive hover:bg-destructive/10",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
      },
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the single child (a link, say) with the button's look instead of a button. */
  asChild?: boolean;
  /** Show a spinner, mark the button busy and ignore presses. */
  loading?: boolean;
  /** Label shown while loading ("Adopting…"); defaults to the children. */
  loadingLabel?: React.ReactNode;
  /**
   * Why the caller's access level can't use this action. The button keeps its
   * label, shows a lock, stays focusable so keyboard users can reach the reason,
   * and ignores presses.
   */
  lockedReason?: string;
}

const Spinner = () => (
  <span
    aria-hidden="true"
    className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
  />
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      children,
      className,
      disabled,
      loading = false,
      loadingLabel,
      lockedReason,
      onClick,
      size,
      type,
      variant,
      ...props
    },
    ref,
  ) => {
    const reasonId = React.useId();
    const locked = Boolean(lockedReason);
    const classes = cn(buttonVariants({ size, variant }), className);

    if (asChild) {
      return (
        <Slot className={classes} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        aria-busy={loading || undefined}
        aria-describedby={locked ? reasonId : props["aria-describedby"]}
        aria-disabled={locked || undefined}
        className={classes}
        disabled={disabled || loading}
        onClick={(event) => {
          if (locked) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
        ref={ref}
        title={lockedReason ?? props.title}
        type={type ?? "button"}
        {...props}
      >
        {loading ? <Spinner /> : null}
        {locked ? <IconLock /> : null}
        {loading && loadingLabel ? loadingLabel : children}
        {locked ? (
          <span className="sr-only" id={reasonId}>
            {lockedReason}
          </span>
        ) : null}
      </button>
    );
  },
);
Button.displayName = "Button";
