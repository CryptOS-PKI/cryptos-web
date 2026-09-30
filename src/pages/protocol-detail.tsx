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

import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { setEnabled, updateAdapter, useAdapters } from "@/lib/adapters";
import { useProfiles } from "@/lib/profiles";

const field = "w-full rounded-md border bg-card px-3 py-2 font-mono text-sm";

// protocolLabels give a human name for the engine that will eventually serve
// each adapter's requests, used in the honest engine-pending note.
const protocolLabels: Record<string, string> = {
  acme: "ACME",
  est: "EST",
  "ms-autoenroll": "Windows autoenrollment",
  scep: "SCEP",
};

export const ProtocolDetailPage = () => {
  const { kind } = useParams<{ kind: string }>();
  const adapters = useAdapters();
  const profiles = useProfiles();
  const { operator } = useAuth();
  const isAdmin = operator?.level === "admin";
  const adapter = adapters.find((a) => a.kind === kind);

  const [togglePending, setTogglePending] = useState(false);
  const [toggleError, setToggleError] = useState("");

  if (!adapter) {
    return <Navigate replace to="/protocols" />;
  }

  const onToggle = async (on: boolean) => {
    setToggleError("");
    setTogglePending(true);
    try {
      const res = await setEnabled(adapter.kind, on);
      if (!res.ok) setToggleError(res.reason ?? "Could not update the adapter.");
    } finally {
      setTogglePending(false);
    }
  };

  const engine = protocolLabels[adapter.kind] ?? "enrollment";

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{adapter.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">Enrollment protocol adapter</p>
      </div>

      <p
        className="max-w-md rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground"
        role="note"
      >
        Enabling records intent. The {engine} service ships in a later release; an enabled adapter
        does not yet serve enrollment requests.
      </p>

      <label className="flex items-center gap-2 font-mono text-sm">
        <input
          checked={adapter.enabled}
          disabled={!isAdmin || togglePending}
          onChange={(e) => void onToggle(e.target.checked)}
          type="checkbox"
        />
        Enabled
        {isAdmin ? null : <span className="text-[11px] text-muted-foreground">(admin only)</span>}
      </label>
      {toggleError ? (
        <p className="max-w-md font-mono text-xs text-destructive" role="alert">
          {toggleError}
        </p>
      ) : null}

      <label className="block max-w-md space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Bound profile
        </span>
        <select
          className={field}
          onChange={(e) => updateAdapter(adapter.kind, { profile: e.target.value })}
          value={adapter.profile}
        >
          {profiles.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block max-w-md space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Endpoint
        </span>
        <input
          className={field}
          onChange={(e) => updateAdapter(adapter.kind, { endpoint: e.target.value })}
          value={adapter.endpoint}
        />
      </label>

      {adapter.kind === "acme" ? (
        <div className="max-w-md space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            ACME challenges
          </span>
          <div className="flex gap-2">
            {["http-01", "dns-01"].map((c) => (
              <label className="flex items-center gap-1.5 font-mono text-xs" key={c}>
                <input
                  checked={(adapter.challenges ?? []).includes(c)}
                  onChange={(e) => {
                    const cur = adapter.challenges ?? [];
                    updateAdapter(adapter.kind, {
                      challenges: e.target.checked ? [...cur, c] : cur.filter((x) => x !== c),
                    });
                  }}
                  type="checkbox"
                />
                {c}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {adapter.kind === "ms-autoenroll" ? (
        <label className="block max-w-md space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            GPO template
          </span>
          <input
            className={field}
            onChange={(e) => updateAdapter(adapter.kind, { gpoTemplate: e.target.value })}
            value={adapter.gpoTemplate ?? ""}
          />
        </label>
      ) : null}

      <Button asChild variant="outline">
        <Link to="/protocols">Back to protocols</Link>
      </Button>
    </section>
  );
};
