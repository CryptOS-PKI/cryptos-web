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

// The manager's /healthz body (cryptos-manager docs/storage.md), served
// anonymously so it answers before sign-in too:
//
//   {"status": "degraded", "storage": {"mode": "memory", "state": "degraded"}}
//   {"status": "ok", "storage": {"mode": "postgres", "state": "ok", "version": "18.1"}}
//
// A manager whose Postgres store is unreachable answers 503 with
// status: "unavailable", still with a storage body.

export type StorageMode = "memory" | "postgres";
export type StorageState = "degraded" | "ok" | "unavailable";

export interface HealthStatus {
  status: "degraded" | "ok" | "unavailable";
  storage: {
    mode: StorageMode;
    state: StorageState;
    version?: string;
  };
}

const isHealthStatus = (value: unknown): value is HealthStatus =>
  typeof value === "object" &&
  value !== null &&
  "storage" in value &&
  typeof (value as { storage: unknown }).storage === "object" &&
  (value as { storage: unknown }).storage !== null &&
  "mode" in (value as { storage: { mode: unknown } }).storage;

/**
 * fetchHealth reads the anonymous /healthz endpoint once. It reads the body
 * on every response, including a 503, because an unreachable Postgres store
 * still reports its storage mode; only a network failure or an unparsable
 * body returns null.
 */
export const fetchHealth = async (): Promise<HealthStatus | null> => {
  try {
    const resp = await fetch("/healthz", { cache: "no-store" });
    const body: unknown = await resp.json();
    return isHealthStatus(body) ? body : null;
  } catch {
    return null;
  }
};
