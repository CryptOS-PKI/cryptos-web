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

import {
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  Fingerprint as FingerprintIcon,
  type LucideIcon,
  ShieldAlert,
} from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn";
import { useCopy } from "./copy-block";

/** Uppercase hex in groups of four, whatever the input format (colons, spaces, lowercase). */
export const fingerprintGroups = (value: string): string[] =>
  value
    .replaceAll(/[^0-9a-f]/gi, "")
    .toUpperCase()
    .match(/.{1,4}/g) ?? [];

/** Compare two fingerprints group by group; `differing` holds zero-based group indexes. */
export const compareFingerprints = (expected: string, actual: string) => {
  const a = fingerprintGroups(expected);
  const b = fingerprintGroups(actual);
  const length = Math.max(a.length, b.length);
  const differing: number[] = [];
  for (let i = 0; i < length; i++) if (a[i] !== b[i]) differing.push(i);
  return { differing, match: differing.length === 0 && a.length > 0 };
};

export interface FingerprintProps {
  className?: string;
  copyable?: boolean;
  /** Group indexes to mark as different. */
  differing?: number[];
  label?: React.ReactNode;
  /** large: compare and read aloud (numbered); medium: tiles and detail; short: tables. */
  size?: "large" | "medium" | "short";
  value: string;
}

const PER_LINE = 8;

export const Fingerprint = ({
  className,
  copyable = false,
  differing = [],
  label,
  size = "medium",
  value,
}: FingerprintProps) => {
  const groups = fingerprintGroups(value);
  const { copied, copy } = useCopy(groups.join(" "));
  const name = `SHA-256 fingerprint, ${groups.length} groups of four`;
  const copyText = copied ? "Copied" : "Copy";

  const copyButton = copyable ? (
    <button
      aria-label="Copy fingerprint"
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        copied ? "text-success" : "text-muted-foreground hover:text-foreground",
      )}
      onClick={() => void copy()}
      type="button"
    >
      {copied ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : (
        <Copy aria-hidden="true" className="size-3.5" />
      )}
      {size === "short" ? null : copyText}
    </button>
  ) : null;

  if (size === "short") {
    const short =
      groups.length > 3 ? `${groups[0]} ${groups[1]} … ${groups.at(-1)}` : groups.join(" ");
    return (
      <span
        aria-label={name}
        className={cn("inline-flex items-center gap-1.5 font-mono text-xs", className)}
        role="group"
      >
        <span>{short}</span>
        {copyButton}
      </span>
    );
  }

  const lines: string[][] = [];
  for (let i = 0; i < groups.length; i += PER_LINE) lines.push(groups.slice(i, i + PER_LINE));
  const large = size === "large";

  return (
    <div className={cn("space-y-2", className)}>
      {label || copyButton ? (
        <div className="flex items-center gap-2">
          {label ? (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </span>
          ) : null}
          <span className="ml-auto">{copyButton}</span>
        </div>
      ) : null}
      <div
        aria-label={name}
        className={cn(
          "font-mono",
          large
            ? "space-y-2 text-[clamp(18px,2.2vw,26px)] font-medium tracking-wide"
            : "space-y-0.5 text-[13px]",
        )}
        role="group"
      >
        {lines.map((line, row) => (
          <div className={cn("flex flex-wrap", large ? "gap-x-4" : "gap-x-2")} key={row}>
            {line.map((group, col) => {
              const index = row * PER_LINE + col;
              const off = differing.includes(index);
              return (
                <span className="inline-flex flex-col items-center" key={index}>
                  <span
                    className={cn(
                      off && "text-destructive underline decoration-wavy underline-offset-4",
                    )}
                  >
                    {group}
                  </span>
                  {large ? (
                    <span
                      aria-hidden="true"
                      className="text-[10px] font-normal text-muted-foreground"
                    >
                      {index + 1}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

type PanelTone = "danger" | "success" | "warning";

const PANEL: Record<PanelTone, { box: string; icon: LucideIcon; text: string }> = {
  danger: {
    box: "border-destructive/40 bg-destructive/5",
    icon: ShieldAlert,
    text: "text-destructive",
  },
  success: { box: "border-success/40 bg-success/5", icon: CircleCheck, text: "text-success" },
  warning: { box: "border-warning/40 bg-warning/5", icon: FingerprintIcon, text: "text-warning" },
};

export interface FingerprintConfirmProps {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Show a field to paste the fingerprint from the node console and compare it. */
  compare?: boolean;
  fingerprint?: string;
  fingerprintLabel?: React.ReactNode;
  onCompare?: (match: boolean) => void;
  /** "Step 1 of 2" */
  step?: React.ReactNode;
  /** Label and value rows above the fingerprint (subject, address). */
  subject?: [React.ReactNode, React.ReactNode][];
  title: string;
  /** warning: first contact, confirm; success: pinned; danger: a wrong confirm grants access. */
  tone: PanelTone;
}

// FingerprintConfirm is the trust confirm panel: before the console trusts a
// node or a CA it shows the fingerprint to check against the node's console,
// optionally compares a pasted copy, and carries the confirm actions.
export const FingerprintConfirm = ({
  actions,
  children,
  className,
  compare = false,
  fingerprint,
  fingerprintLabel = "SHA-256",
  onCompare,
  step,
  subject = [],
  title,
  tone,
}: FingerprintConfirmProps) => {
  const titleId = React.useId();
  const pasteId = React.useId();
  const [pasted, setPasted] = React.useState("");
  const t = PANEL[tone];
  const Icon = t.icon;
  const result = fingerprint && pasted ? compareFingerprints(fingerprint, pasted) : null;

  return (
    <section
      aria-labelledby={titleId}
      className={cn("space-y-3 rounded-lg border p-5", t.box, className)}
      data-tone={tone}
    >
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className={cn("size-4", t.text)} />
        <h3 className="text-[15px] font-semibold" id={titleId}>
          {title}
        </h3>
        {step ? (
          <span
            className={cn("ml-auto font-mono text-[10.5px] uppercase tracking-[0.08em]", t.text)}
          >
            {step}
          </span>
        ) : null}
      </div>
      {children ? <div className="text-[13px] leading-relaxed">{children}</div> : null}
      {subject.length > 0 || fingerprint ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-[13px]">
          {subject.map(([k, v], i) => (
            <React.Fragment key={i}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-all">{v}</dd>
            </React.Fragment>
          ))}
          {fingerprint ? (
            <>
              <dt className="text-muted-foreground">{fingerprintLabel}</dt>
              <dd>
                <Fingerprint differing={result?.differing} value={fingerprint} />
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {compare && fingerprint ? (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground" htmlFor={pasteId}>
            Paste the fingerprint to compare
          </label>
          <input
            autoComplete="off"
            className="h-9 w-full rounded-md border bg-background px-3 font-mono text-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            id={pasteId}
            onChange={(event) => {
              setPasted(event.target.value);
              if (event.target.value)
                onCompare?.(compareFingerprints(fingerprint, event.target.value).match);
            }}
            spellCheck={false}
            value={pasted}
          />
          {result ? (
            result.match ? (
              <p className="flex items-center gap-1.5 text-xs text-success" role="status">
                <CircleCheck aria-hidden="true" className="size-3.5" />
                All {fingerprintGroups(fingerprint).length} groups match.
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <CircleAlert aria-hidden="true" className="size-3.5" />
                {result.differing.length === 1
                  ? `That fingerprint doesn't match. Group ${result.differing[0] + 1} differs. Don't confirm.`
                  : `That fingerprint doesn't match. ${result.differing.length} groups differ. Don't confirm.`}
              </p>
            )
          ) : null}
        </div>
      ) : null}
      {actions ? <div className="flex flex-wrap gap-2 pt-1">{actions}</div> : null}
    </section>
  );
};
