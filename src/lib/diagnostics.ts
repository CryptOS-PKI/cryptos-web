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

import type { AuthStatus, DenialReason, Operator } from "@/context/auth";

// A report-ready summary of the page and the build behind it.
//
// Alpha reports arrived without the context needed to diagnose them, so every
// one cost a round trip establishing which build was running and what state the
// page was in (#83). The instance at 1670 was several fixes behind and nothing
// in the UI said so.
//
// Everything here is already visible to the person reading the page: the build
// strings the manager serves anonymously, their own certificate's subject and
// serial, the route they are on, and their browser. Nothing is read that an
// operator could not read themselves, and no secret is reachable from the
// browser to begin with.

export interface BuildInfo {
  buildDate: string;
  commit: string;
  version: string;
  webRef: string;
}

/** Served anonymously by the manager, so it answers before sign-in too. */
export const fetchBuildInfo = async (): Promise<BuildInfo | null> => {
  try {
    const resp = await fetch("/version", { cache: "no-store" });
    if (!resp.ok) return null;

    return (await resp.json()) as BuildInfo;
  } catch {
    // A missing build endpoint is itself worth reporting, so the report is
    // still produced -- with the build marked unavailable rather than absent.
    return null;
  }
};

export interface ReportInput {
  build: BuildInfo | null;
  fleetMode: string;
  operator: null | Operator;
  reason: DenialReason | null;
  route: string;
  status: AuthStatus;
  userAgent: string;
}

const line = (label: string, value: string): string => `${label.padEnd(12)}${value}`;

/**
 * buildReport renders the block an operator pastes into an issue. Plain text on
 * purpose: it survives a paste into GitHub, Slack or an email without becoming
 * a screenshot nobody can search.
 */
export const buildReport = (input: ReportInput): string => {
  const rows = [
    line("when", new Date().toISOString()),
    line("page", input.route),
    line("auth", input.reason ? `${input.status} (${input.reason})` : input.status),
  ];

  if (input.operator) {
    rows.push(
      line("operator", `${input.operator.commonName} (${input.operator.level})`),
      line("serial", input.operator.serial),
    );
  }

  rows.push(
    input.build
      ? line(
          "manager",
          `${input.build.version} (${input.build.commit}, built ${input.build.buildDate})`,
        )
      : line("manager", "unavailable (GET /version did not answer)"),
    line("web", input.build ? input.build.webRef : "unknown"),
    line("mode", input.fleetMode),
    line("browser", input.userAgent),
  );

  return `FleetOS diagnostics\n${rows.join("\n")}`;
};
