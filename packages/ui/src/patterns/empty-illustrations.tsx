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

// nodes, certificates and requests are ported from the brand set's empty-state
// drawings (its "certs" and "approvals" kinds map onto certificates and
// requests here) and built from the mark's own geometry: the open body, the
// channel and the cores, in muted outline (currentColor, so it follows
// text-muted-foreground by default like the rest of the kit) with one primary
// accent, the same two-tone convention CryptosMark/FleetosMark already use.
// audit and generic have no drawing in that set, so they stay hand-drawn
// placeholders in the same muted single-tone line style.
const DRAWINGS: Record<EmptyIllustrationKind, React.ReactNode> = {
  audit: (
    <>
      <rect
        fill="none"
        height={64}
        rx={5}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        width={56}
        x={46}
        y={10}
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
        x1={54}
        x2={90}
        y1={24}
        y2={24}
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
        x1={54}
        x2={90}
        y1={36}
        y2={36}
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
        x1={54}
        x2={78}
        y1={48}
        y2={48}
      />
      <circle
        cx={100}
        cy={58}
        fill="none"
        r={16}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
        x1={112}
        x2={126}
        y1={70}
        y2={80}
      />
    </>
  ),
  certificates: (
    <>
      <rect
        fill="none"
        height={64}
        rx={6}
        stroke="currentColor"
        strokeDasharray="4 5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        width={52}
        x={50}
        y={14}
      />
      <rect
        fill="none"
        height={64}
        rx={6}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        width={52}
        x={58}
        y={6}
      />
      <line
        className="stroke-primary"
        strokeLinecap="round"
        strokeWidth={3}
        x1={68}
        x2={100}
        y1={24}
        y2={24}
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
        x1={68}
        x2={92}
        y1={36}
        y2={36}
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
        x1={68}
        x2={84}
        y1={48}
        y2={48}
      />
    </>
  ),
  generic: (
    <>
      <path
        d="M34 50h92l-13 26H47z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <path
        d="M34 50l16-34h58l16 34"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <path
        d="M66 50v12h28V50"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </>
  ),
  nodes: (
    <>
      <path
        d="M40 20H29a9 9 0 0 0-9 9V61a9 9 0 0 0 9 9H61a9 9 0 0 0 9-9V29a9 9 0 0 0-9-9H50"
        fill="none"
        stroke="currentColor"
        strokeDasharray="4 5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <path
        d="M110 20H99a9 9 0 0 0-9 9V61a9 9 0 0 0 9 9H131a9 9 0 0 0 9-9V29a9 9 0 0 0-9-9H120"
        fill="none"
        stroke="currentColor"
        strokeDasharray="4 5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <line
        stroke="currentColor"
        strokeDasharray="3 4"
        strokeLinecap="round"
        strokeWidth={2}
        x1={70}
        x2={90}
        y1={45}
        y2={45}
      />
      <line
        className="stroke-primary"
        strokeLinecap="round"
        strokeWidth={3}
        x1={45}
        x2={45}
        y1={10}
        y2={34}
      />
      <rect className="fill-primary" height={16} rx={3} width={16} x={37} y={37} />
    </>
  ),
  requests: (
    <>
      <circle
        cx={80}
        cy={42}
        fill="none"
        r={30}
        stroke="currentColor"
        strokeDasharray="4 5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <path
        className="stroke-primary"
        d="M66 43l9 9 18-19"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />
    </>
  ),
};

export const EmptyIllustration = ({ kind }: EmptyIllustrationProps) => (
  <svg
    aria-hidden="true"
    className="text-muted-foreground"
    height={84}
    viewBox="0 0 160 84"
    width={160}
    xmlns="http://www.w3.org/2000/svg"
  >
    {DRAWINGS[kind]}
  </svg>
);
