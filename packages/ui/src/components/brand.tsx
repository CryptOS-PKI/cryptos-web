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

import { cn } from "../lib/cn";

interface MarkProps {
  className?: string;
  size?: number;
  /** Label the mark for screen readers; without it the mark is decorative. */
  title?: string;
}

const svgProps = ({ className, size = 24, title }: MarkProps) => ({
  "aria-hidden": title ? undefined : ("true" as const),
  "aria-label": title,
  className: cn("shrink-0", className),
  height: size,
  role: title ? "img" : undefined,
  viewBox: "0 0 48 48",
  width: size,
});

// The marks from brand/: an open body with one channel in. The body follows the
// text colour; the channel and cores are the primary (Shield Blue).

/** The CryptOS mark: one core. Also the root role icon. */
export const CryptosMark = (props: MarkProps) => (
  <svg {...svgProps(props)}>
    <path
      d="M18 6H14a8 8 0 0 0-8 8v20a8 8 0 0 0 8 8h20a8 8 0 0 0 8-8V14a8 8 0 0 0-8-8H30"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={5}
    />
    <path className="stroke-primary" d="M24 3v15" strokeLinecap="round" strokeWidth={5} />
    <rect className="fill-primary" height={14} rx={3} width={14} x={17} y={17} />
  </svg>
);

/** The FleetOS mark: four cores, one per node. */
export const FleetosMark = (props: MarkProps) => (
  <svg {...svgProps(props)}>
    <path
      d="M19 6H14a8 8 0 0 0-8 8v20a8 8 0 0 0 8 8h20a8 8 0 0 0 8-8V14a8 8 0 0 0-8-8H29"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={4}
    />
    <path className="stroke-primary" d="M24 3v21" strokeLinecap="round" strokeWidth={4} />
    <rect className="fill-primary" height={7} rx={1.5} width={7} x={14.5} y={15.5} />
    <rect className="fill-primary" height={7} rx={1.5} width={7} x={26.5} y={15.5} />
    <rect className="fill-primary" height={7} rx={1.5} width={7} x={14.5} y={26.5} />
    <rect className="fill-primary" height={7} rx={1.5} width={7} x={26.5} y={26.5} />
  </svg>
);

/** Mark plus the mono wordmark, with "OS" in the primary colour. */
export const Wordmark = ({
  className,
  markSize = 24,
  product,
}: {
  className?: string;
  markSize?: number;
  product: "CryptOS" | "FleetOS";
}) => {
  const Mark = product === "FleetOS" ? FleetosMark : CryptosMark;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-mono text-[17px] font-bold tracking-[-0.025em]",
        className,
      )}
    >
      <Mark size={markSize} />
      <span>
        <span>{product.slice(0, -2)}</span>
        <span className="text-primary">OS</span>
      </span>
    </span>
  );
};
