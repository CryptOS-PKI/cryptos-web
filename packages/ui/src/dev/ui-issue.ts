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

import type { Role } from "../patterns/role-gate";

export const UI_ISSUE_MARKER = "__CRYPTOS_DEV_UI_ISSUE__";

export type RingError = { at: string; m: string; src: "api" | "promise" | "window" };

export type UiIssueInput = {
  clicked?: string;
  dpr: number;
  lastErr?: RingError;
  locale?: string;
  now: Date;
  params: Record<string, string>;
  path: string;
  recentErrors?: RingError[];
  role?: Role;
  route: string;
  sha: string;
  theme?: "dark" | "light";
  ua: string;
  vh: number;
  vw: number;
};

// Opaque ids only: a prefix_ and base32/hex body, a UUID, or digits. Serials
// (colon hex), names and emails are dropped. The body minimum is 5, not 6: a
// ULID-style suffix like "01HZX" is as short as this gets in practice.
const OPAQUE_ID =
  /^(?:[a-z]{1,8}_[0-9A-Za-z]{5,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{1,12})$/;

export const redactMessage = (m: string): string =>
  m
    .replaceAll(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[pem]")
    .replaceAll(/\?[^\s"']*/g, "")
    .replaceAll(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replaceAll(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, "[jwt]")
    .replaceAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .slice(0, 200);

const etIso = (d: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
    year: "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const offset = get("timeZoneName").replace("GMT", "") || "+00:00";
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}.${ms}${offset}`;
};

const clean = (e: RingError): RingError => ({ ...e, m: redactMessage(e.m) });

export const buildUiIssueBundle = (i: UiIssueInput): string => {
  const params = Object.fromEntries(Object.entries(i.params).filter(([, v]) => OPAQUE_ID.test(v)));
  const out: Record<string, unknown> = {
    app: "cryptos-web/console",
    clicked: i.clicked,
    dpr: i.dpr,
    lastErr: i.lastErr ? clean(i.lastErr) : undefined,
    locale: i.locale,
    params,
    path: i.path,
    product: "cryptos",
    recentErrors: i.recentErrors?.slice(-5).map((e) => clean(e)),
    role: i.role,
    route: i.route,
    sha: i.sha,
    t: etIso(i.now),
    theme: i.theme,
    ua: i.ua,
    v: 1,
    vh: i.vh,
    vw: i.vw,
  };
  for (const [k, v] of Object.entries(out)) {
    if (
      v === undefined ||
      v === "" ||
      (typeof v === "object" && v !== null && Object.keys(v).length === 0)
    ) {
      delete out[k];
    }
  }
  return JSON.stringify(out);
};
