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

// Opaque ids only: a ULID (26 chars of Crockford base32: 0-9, A-Z minus
// I/L/O/U) or a UUID. A prefix_username shape (j_smith, ca_root01) and a bare
// decimal serial both read as plausible opaque ids but are not -- usernames
// and sequential serials are identity, so neither alternative is kept.
const ULID = "[0-9A-HJKMNP-TV-Z]{26}";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const OPAQUE_ID = new RegExp(`^(?:${ULID}|${UUID})$`, "i");

// Each rule below redacts one shape of sensitive text before the 200-char
// truncation. Order matters: a value a later rule would also catch (a
// Bearer token looks like a long secret; a redacted URL's userinfo looks
// like a cookie pair) is handled by its own, more specific rule first.
const PEM_BLOCK = /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g;
// A BEGIN with no matching END: the message was cut off mid-block. Treat
// everything from BEGIN to the end of the string as sensitive.
const PEM_TRUNCATED = /-----BEGIN [A-Z ]+-----[\s\S]*$/g;
const QUERY_STRING = /\?[^\s"']*/g;
const FRAGMENT = /#[^\s"']*/g;
const BASIC_AUTH = /\bBasic\s+\S+/gi;
const BEARER_TOKEN = /\bBearer\s+\S+/gi;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]*/g;
// A cookie- or form-field-style pair: a key, "=", and a value with no
// separator for at least 8 characters.
const KEY_VALUE_PAIR = /\b[\w-]+=[^\s&;]{8,}/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// scheme://[user[:pass]@]host, stopping at the first "/", "?" or "#": this
// also strips any userinfo, since it is part of what gets replaced.
const URL_AUTHORITY = /\b([a-z][a-z\d+.-]*):\/\/(?:[^\s/@]*@)?[^\s/?#]+/gi;
// A bare FQDN with no scheme: at least three labels, so a two-part filename
// like "config.yaml" is left alone.
const BARE_HOSTNAME = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){2,}[a-z]{2,}\b/gi;
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
const IPV6_FULL = /\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi;
const IPV6_COMPRESSED =
  /\b(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*)?::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*)?\b/gi;
// A catch-all for a long token this didn't already have a name for. Requires
// a digit, so a long run of the same letter (seen in tests, and plausible in
// a wrapped or padded message) is not mistaken for a secret.
const LONG_SECRET = /\b[\w+/-]{24,}={0,2}\b/g;

export const redactMessage = (m: string): string =>
  m
    .replaceAll(PEM_BLOCK, "[pem]")
    .replaceAll(PEM_TRUNCATED, "[pem]")
    .replaceAll(QUERY_STRING, "")
    .replaceAll(FRAGMENT, "")
    .replaceAll(BASIC_AUTH, "Basic [redacted]")
    .replaceAll(BEARER_TOKEN, "Bearer [redacted]")
    .replaceAll(JWT, "[jwt]")
    .replaceAll(KEY_VALUE_PAIR, "[redacted]")
    .replaceAll(EMAIL, "[email]")
    .replaceAll(URL_AUTHORITY, "$1://[host]")
    .replaceAll(BARE_HOSTNAME, "[host]")
    .replaceAll(IPV4, "[ip]")
    .replaceAll(IPV6_FULL, "[ip]")
    .replaceAll(IPV6_COMPRESSED, "[ip]")
    .replaceAll(LONG_SECRET, (match) => (/\d/.test(match) ? "[redacted]" : match))
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
