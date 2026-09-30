/*
Apache License 2.0

Copyright 2026 Shane

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

import { branding } from "@/lib/branding";

// Shield glyph rendered from an escape so no literal emoji lands in source
// (matches the wordmark convention). This is the shipped default mark.
const SHIELD = "\u{1F6E1}\u{FE0F}";

// The mark drawn inside the root node. This is a configurable slot, not a
// hardcoded glyph: when an operator logo URL is provided it renders an SVG
// <image>; otherwise it falls back to the CryptOS shield. Swapping the brand is
// a one-line change in src/lib/branding.ts.
export const RootMark = ({
  logoUrl = branding.rootLogoUrl,
  size = 34,
  y = 4,
}: {
  /** Operator logo URL. Undefined -> the shield fallback. */
  logoUrl?: string;
  /** Rendered logo edge length in SVG user units (square). */
  size?: number;
  /** Vertical baseline for the shield glyph text. */
  y?: number;
}) => {
  if (logoUrl) {
    return (
      <image
        aria-hidden="true"
        height={size}
        href={logoUrl}
        preserveAspectRatio="xMidYMid meet"
        width={size}
        x={-size / 2}
        y={-size / 2}
      />
    );
  }
  return (
    <text
      aria-hidden="true"
      className="fill-foreground font-mono font-semibold"
      style={{ fontSize: 12 }}
      textAnchor="middle"
      y={y}
    >
      {SHIELD}
    </text>
  );
};
