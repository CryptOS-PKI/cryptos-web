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

export type EmptyIllustrationKind = "audit" | "certificates" | "generic" | "nodes" | "requests";

export interface EmptyIllustrationProps {
  kind: EmptyIllustrationKind;
}

// Hand-drawn line art in the kit's icon style (currentColor stroke, rounded
// caps and joins), not generated, so there is no design-tool metadata to
// strip. Decorative only: the EmptyState title and body next to it carry the
// meaning.
const DRAWINGS: Record<EmptyIllustrationKind, React.ReactNode> = {
  audit: (
    <>
      <rect height="58" rx="4" width="44" x="18" y="16" />
      <path d="M26 28h28M26 38h28M26 48h18" />
      <circle cx="66" cy="62" r="14" />
      <path d="M76 72l10 10" />
    </>
  ),
  certificates: (
    <>
      <rect height="64" rx="4" width="52" x="22" y="16" />
      <path d="M30 30h36M30 40h36M30 50h22" />
      <circle cx="60" cy="64" r="10" />
      <path d="M55 72l-4 10 9-5 9 5-4-10" />
    </>
  ),
  generic: (
    <>
      <path d="M20 46h56l-8 26H28z" />
      <path d="M20 46l10-24h36l10 24" />
      <path d="M40 46v10h16V46" />
    </>
  ),
  nodes: (
    <>
      <circle cx="48" cy="24" r="8" />
      <circle cx="24" cy="66" r="8" />
      <circle cx="72" cy="66" r="8" />
      <path d="M43 31l-13 28M53 31l13 28M32 66h32" />
    </>
  ),
  requests: (
    <>
      <rect height="60" rx="4" width="48" x="20" y="18" />
      <path d="M28 32h32M28 42h32M28 52h20" />
      <circle cx="68" cy="68" r="14" />
      <path d="M68 60v8l6 4" />
    </>
  ),
};

export const EmptyIllustration = ({ kind }: EmptyIllustrationProps) => (
  <svg
    aria-hidden="true"
    className="size-24 text-muted-foreground"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.5}
    viewBox="0 0 96 96"
    xmlns="http://www.w3.org/2000/svg"
  >
    {DRAWINGS[kind]}
  </svg>
);
