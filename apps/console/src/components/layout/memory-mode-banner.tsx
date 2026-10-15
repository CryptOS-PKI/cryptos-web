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

import { IconClose } from "@cryptos-pki/ui";
import { useEffect, useState } from "react";

import { fetchHealth } from "@/lib/health";

// MemoryModeBanner warns when the Fleet Manager it talks to runs
// storage.mode: memory: operator registrations and the manager's own audit
// log are lost on restart (cryptos-manager docs/storage.md); the CA nodes
// keep their own audit chains regardless. It reads /healthz once per mount,
// never on a timer, so dismissing it only lasts until the next full page
// load -- a real warning can't be hidden permanently.
export const MemoryModeBanner = () => {
  const [memory, setMemory] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((health) => {
        if (!cancelled) setMemory(health?.storage.mode === "memory");
      })
      .catch(() => {
        if (!cancelled) setMemory(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!memory || dismissed) return null;

  return (
    <div className="flex h-8 shrink-0 items-center gap-2.5 border-b border-warning/40 bg-warning/10 px-5 text-[12.5px]">
      <span className="rounded bg-warning px-1.5 py-px font-mono text-[10.5px] font-bold tracking-[0.06em] text-warning-foreground">
        MEMORY MODE
      </span>
      <span className="min-w-0 flex-1 truncate">
        This Fleet Manager keeps its state in memory: operator registrations and its audit log are
        lost on restart. Its CA nodes keep their own audit chains.
      </span>
      <button
        aria-label="Dismiss"
        className="shrink-0 text-warning-foreground/70 hover:text-warning-foreground"
        onClick={() => setDismissed(true)}
        type="button"
      >
        <IconClose className="size-3.5" />
      </button>
    </div>
  );
};
