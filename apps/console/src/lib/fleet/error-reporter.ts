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

import type { Interceptor } from "@connectrpc/connect";

import { errorCode, errorReason } from "@/lib/fleet/error-code";

// A tiny broadcast point for every FleetService and BootstrapService call
// that fails, independent of whether the caller handles the rejection. The
// dev-only UI-issue button (apps/console/src/dev/mount-ui-issue.tsx)
// subscribes to this so an API refusal shows up in its error ring even when
// the page that triggered it caught the error and never threw an
// unhandledrejection.
export interface ApiErrorEvent {
  code: number | undefined;
  reason: string | undefined;
}

type Listener = (event: ApiErrorEvent) => void;

const listeners = new Set<Listener>();

export const onApiError = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const reportApiError = (event: ApiErrorEvent): void => {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A broken listener must not replace, or hide, the caller's own error.
    }
  }
};

// Installed on both FleetService's (client.ts) and BootstrapService's
// (lib/bootstrap.ts) transports. Reports every refusal, then rethrows the
// identical error: callers see exactly what they would without this.
export const reportApiErrors: Interceptor = (next) => async (req) => {
  try {
    return await next(req);
  } catch (error) {
    reportApiError({ code: errorCode(error), reason: errorReason(error) });
    throw error;
  }
};
