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

import { type LucideIcon, Menu, X } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn";
import { useFocusTrap } from "../lib/focus-trap";
import { useIsDesktop } from "../lib/use-media-query";

export interface AppShellProps {
  /** A strip under the top bar (the pre-1.0 notice). */
  banner?: React.ReactNode;
  /** The wordmark, top left. */
  brand: React.ReactNode;
  children: React.ReactNode;
  /** NavSection and NavItem elements. */
  nav: React.ReactNode;
  /** Small print at the bottom of the sidebar (the version). */
  navFooter?: React.ReactNode;
  /** The right side of the top bar: identity, level, diagnostics, theme. */
  topBar?: React.ReactNode;
}

const Sidebar = ({ footer, nav }: { footer?: React.ReactNode; nav: React.ReactNode }) => (
  <>
    <div className="flex flex-col gap-0.5">{nav}</div>
    {footer ? (
      <div className="mt-auto px-2.5 pt-4 font-mono text-[11px] text-muted-foreground/70">
        {footer}
      </div>
    ) : null}
  </>
);

// AppShell is the console frame: the top bar, an optional banner strip, the
// grouped sidebar and the page. Below 768 px the sidebar moves into a drawer
// opened from the top bar.
export const AppShell = ({ banner, brand, children, nav, navFooter, topBar }: AppShellProps) => {
  const desktop = useIsDesktop();
  const [open, setOpen] = React.useState(false);
  const drawer = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const drawerOpen = open && !desktop;
  useFocusTrap(drawer, drawerOpen, "nav [aria-current='page'], nav a[href]");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3.5 border-b bg-card px-4 md:pl-5">
        {desktop ? null : (
          <button
            aria-expanded={drawerOpen}
            aria-label="Open navigation"
            className="-ml-1 flex size-9 items-center justify-center rounded-md hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setOpen(true)}
            type="button"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
        )}
        <div className="flex min-w-0 items-center">{brand}</div>
        {topBar ? <div className="ml-auto flex min-w-0 items-center gap-2.5">{topBar}</div> : null}
      </header>
      {banner}
      <div className="flex min-h-0 flex-1">
        {desktop ? (
          <nav
            aria-label="Main"
            className="sticky top-14 flex max-h-[calc(100vh-3.5rem)] w-[232px] shrink-0 flex-col overflow-y-auto border-r bg-card px-2.5 py-3"
          >
            <Sidebar footer={navFooter} nav={nav} />
          </nav>
        ) : null}
        <main className="min-w-0 flex-1 px-4 pb-10 pt-5 md:px-8 md:pt-7">{children}</main>
      </div>
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/60"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            aria-labelledby={titleId}
            aria-modal="true"
            className="flex h-full w-[min(300px,85vw)] flex-col overflow-y-auto border-r bg-card px-2.5 py-3"
            onClick={(event) => {
              event.stopPropagation();
              if ((event.target as HTMLElement).closest("a")) setOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
            ref={drawer}
            role="dialog"
          >
            <div className="mb-2 flex items-center justify-between px-2.5">
              <span className="sr-only" id={titleId}>
                Navigation
              </span>
              {brand}
              <button
                aria-label="Close navigation"
                className="flex size-9 items-center justify-center rounded-md hover:bg-secondary"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <nav aria-label="Main" className="flex flex-1 flex-col">
              <Sidebar footer={navFooter} nav={nav} />
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const NavSection = ({ children, label }: { children: React.ReactNode; label?: string }) => (
  <div className="flex flex-col gap-0.5">
    {label ? (
      <p className="px-2.5 pb-1.5 pt-3.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
    ) : null}
    {children}
  </div>
);

export interface NavItemProps {
  active?: boolean;
  /** Render into the single child (a router link); its own children are replaced. */
  asChild?: boolean;
  badge?: number | string;
  badgeLabel?: string;
  children?: React.ReactElement<Record<string, unknown>>;
  href?: string;
  icon: LucideIcon;
  label: string;
  /** Why the caller's level can't use this page; dims the item and sets a tooltip. */
  locked?: string;
}

export const NavItem = ({
  active = false,
  asChild = false,
  badge,
  badgeLabel,
  children,
  href,
  icon: Icon,
  label,
  locked,
}: NavItemProps) => {
  const className = cn(
    "flex h-[34px] items-center gap-2.5 rounded-md px-2.5 font-mono text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-secondary text-foreground"
      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
    locked && "opacity-55",
  );
  const content = (
    <>
      <Icon
        aria-hidden="true"
        className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
      />
      <span className="truncate">{label}</span>
      {badge !== undefined && badge !== 0 ? (
        <span
          aria-label={badgeLabel}
          className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 font-sans text-[11px] font-bold text-warning-foreground"
        >
          {badge}
        </span>
      ) : null}
    </>
  );
  const attrs = {
    "aria-current": active ? ("page" as const) : undefined,
    className,
    title: locked,
  };
  if (asChild && children) return React.cloneElement(children, { ...attrs, children: content });
  return (
    <a href={href} {...attrs}>
      {content}
    </a>
  );
};

export interface PageHeaderProps {
  actions?: React.ReactNode;
  /** A link back to the parent list. */
  back?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  title: React.ReactNode;
}

export const PageHeader = ({ actions, back, className, description, title }: PageHeaderProps) => (
  <div className={cn("mb-5 flex flex-wrap items-end gap-4", className)}>
    <div className="flex min-w-0 flex-col gap-1">
      {back ? (
        <div className="mb-1 text-[13px] text-primary [&_a:hover]:underline">{back}</div>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">{title}</h1>
      {description ? <div className="text-[13px] text-muted-foreground">{description}</div> : null}
    </div>
    {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);
