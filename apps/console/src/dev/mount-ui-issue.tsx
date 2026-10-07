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
  createErrorRing,
  type RingError,
  UiIssueCopy,
  type UiIssueInput,
} from "@cryptos-pki/ui/dev";
import { createRoot } from "react-dom/client";
import { matchPath } from "react-router-dom";

import { onApiError } from "@/lib/fleet/error-reporter";

const META_SELECTOR = 'meta[name="cryptos-dev-ui-issue-copy"]';

// Mirrors App.tsx's route table so a route pattern can be read without a live
// Router context (this mounts its own root, outside the app's component
// tree). Entries that share a path depth with a dynamic sibling list the
// static one first ("profiles/new" before "profiles/:name").
const ROUTE_PATTERNS = [
  "/oauth/consent",
  "/request-credential",
  "/",
  "/fleet",
  "/nodes",
  "/nodes/:name/config",
  "/nodes/:name/profiles",
  "/nodes/:name/issue",
  "/nodes/:name/rekey",
  "/nodes/:name/certs/:serial",
  "/nodes/:name",
  "/root",
  "/root/:name",
  "/enrollment",
  "/enrollment/:id",
  "/audit",
  "/operator-cas",
  "/operators",
  "/agent-keys",
  "/approvals",
  "/adopt",
  "/certificates",
  "/profiles/new",
  "/profiles/:name",
  "/profiles",
  "/protocols/:kind",
  "/protocols",
];

const matchRoute = (pathname: string): { params: Record<string, string>; route: string } => {
  for (const pattern of ROUTE_PATTERNS) {
    const match = matchPath(pattern, pathname);
    if (match) {
      return { params: match.params as Record<string, string>, route: pattern };
    }
  }
  return { params: {}, route: pathname };
};

// The selector for an element with no data-testid: tag plus classes only,
// walked up a few ancestors. Never the element's text.
const cssPath = (el: Element): string => {
  const segments: string[] = [];
  let node: Element | null = el;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    const classes =
      node.className && typeof node.className === "string"
        ? `.${node.className.trim().replaceAll(/\s+/g, ".")}`
        : "";
    segments.unshift(`${node.tagName.toLowerCase()}${classes}`);
  }
  return segments.join(">");
};

const clickedSelector = (target: EventTarget | null): string | undefined => {
  if (!(target instanceof Element)) {
    return undefined;
  }
  const testEl = target.closest("[data-testid]");
  if (testEl instanceof HTMLElement) {
    return testEl.dataset.testid ?? undefined;
  }
  return cssPath(target);
};

// mountUiIssue wires the dev-only "Copy for UI issue" button in. It is only
// ever reached from main.tsx behind the DEV_UI_ISSUE_COPY build flag, and it
// still requires the manager's meta tag at runtime: a build with the flag on
// but talking to a manager that doesn't advertise the tag renders nothing.
export const mountUiIssue = (): void => {
  const enabled = document.querySelector(META_SELECTOR)?.getAttribute("content") === "true";
  if (!enabled) {
    return;
  }

  const ring = createErrorRing();
  let clicked: string | undefined;

  const record = (e: Omit<RingError, "at">) => ring.push({ ...e, at: new Date().toISOString() });

  globalThis.addEventListener("error", (event) => {
    record({ m: String(event.error?.message ?? event.message), src: "window" });
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    record({ m: message, src: "promise" });
  });
  onApiError(({ code, reason }) => {
    record({ m: `${code ?? ""} ${reason ?? ""}`.trim(), src: "api" });
  });
  document.addEventListener(
    "click",
    (event) => {
      clicked = clickedSelector(event.target) ?? clicked;
    },
    true,
  );

  const collect = (): UiIssueInput => {
    const { params, route } = matchRoute(globalThis.location.pathname);
    // No role: this root is mounted outside the app's component tree, and
    // the auth context has no synchronous, non-hook accessor to read from
    // out here. The field is optional for exactly this case.
    return {
      clicked,
      dpr: globalThis.devicePixelRatio,
      lastErr: ring.last(),
      locale: navigator.language,
      now: new Date(),
      params,
      path: route,
      recentErrors: ring.all(),
      route,
      sha: import.meta.env.VITE_GIT_SHA ?? "",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      ua: navigator.userAgent,
      vh: globalThis.innerHeight,
      vw: globalThis.innerWidth,
    };
  };

  const container = document.createElement("div");
  document.body.append(container);
  createRoot(container).render(<UiIssueCopy collect={collect} />);
};
