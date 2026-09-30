/*
Apache License 2.0

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

import { useCallback, useEffect, useState } from "react";

import type { MachineConfig } from "@/gen/fleet/cryptos/v1/config_pb";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import {
  applyNodeConfig,
  type ApplyResult,
  formatList,
  getNodeConfig,
  parseList,
} from "@/lib/config";
import { fleetMode } from "@/lib/fleet/mode";
import { type Node } from "@/lib/mock";

const tiers = ["nodeID (dev)", "TPM-sealed", "HSM"];
const field = "w-full rounded-md border bg-card px-3 py-2 font-mono text-sm";
const label = "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

// stateKeyMode maps a display tier to the node's StateKey.mode token, and back,
// so the picker edits the real config field without inventing new values.
const tierToMode: Record<string, string> = {
  HSM: "kms",
  "nodeID (dev)": "nodeid",
  "TPM-sealed": "tpm",
};
const modeToTier: Record<string, string> = {
  kms: "HSM",
  nodeid: "nodeID (dev)",
  tpm: "TPM-sealed",
};

// MockConfigDemo keeps the pre-live in-memory form for `mock` mode: it edits
// local state off the node fixture and drives no RPC, so the fixture UI still
// demonstrates the config surface.
const MockConfigDemo = ({ node }: { node: Node }) => {
  const [crl, setCrl] = useState(node.crl ?? "");
  const [ocsp, setOcsp] = useState(node.ocsp ?? "");
  const [tier, setTier] = useState(tiers[0]);
  const [applied, setApplied] = useState(false);

  return (
    <div className="max-w-md space-y-4">
      <label className="block space-y-1">
        <span className={label}>CRL distribution point</span>
        <input className={field} onChange={(e) => setCrl(e.target.value)} value={crl} />
      </label>
      <label className="block space-y-1">
        <span className={label}>OCSP responder</span>
        <input className={field} onChange={(e) => setOcsp(e.target.value)} value={ocsp} />
      </label>
      <label className="block space-y-1">
        <span className={label}>Key protection tier</span>
        <select className={field} onChange={(e) => setTier(e.target.value)} value={tier}>
          {tiers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {applied ? (
        <p className="font-mono text-sm text-success">Config applied to {node.name}.</p>
      ) : null}
      <Button onClick={() => setApplied(true)} type="button">
        Apply
      </Button>
    </div>
  );
};

// sameList compares two list-valued fields by content, so a control the operator
// left alone is never mistaken for an edit.
const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((entry, i) => entry === b[i]);

// LiveConfigForm implements the whole-config-safe fetch-edit-apply flow: on
// mount it fetches the node's FULL current config and holds it as the baseline,
// the form edits only a safe subset (revocation base URL, key-protection tier,
// DNS resolver),
// and Apply sends the baseline with just those fields changed -- never a fresh
// partial config, which would drop untouched fields such as `management` and
// unlink the node from the fleet. Applying is admin-only and mirrors the
// server-side gate; a viewer/operator sees a read-only notice. Errors surface
// inline (no native popup) and the config is refetched after a successful apply.
const LiveConfigForm = ({ node }: { node: Node }) => {
  const { operator } = useAuth();
  const isAdmin = operator?.level === "admin";

  const [baseline, setBaseline] = useState<MachineConfig | null>(null);
  const [loadError, setLoadError] = useState("");
  const [crl, setCrl] = useState("");
  const [tier, setTier] = useState(tiers[0]);
  const [nameservers, setNameservers] = useState("");
  const [search, setSearch] = useState("");

  const [pending, setPending] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [result, setResult] = useState<ApplyResult | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const config = await getNodeConfig(node.name);
      setBaseline(config);
      setCrl(config.pki?.revocationBaseUrl ?? "");
      setTier(modeToTier[config.stateKey?.mode ?? ""] ?? tiers[0]);
      setNameservers(formatList(config.network?.nameservers));
      setSearch(formatList(config.network?.search));
    } catch (error_: unknown) {
      setLoadError(error_ instanceof Error ? error_.message : "Failed to load config");
    }
  }, [node.name]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!baseline) return;
    setPending(true);
    setApplyError("");
    setResult(null);
    try {
      // Merge the edits onto a full clone of the fetched baseline so every
      // untouched field (management, role, bootstrap, ...) is sent back as-is.
      // Only fields the operator actually changed are written; an unchanged
      // control leaves the baseline value (including its absence) intact, so no
      // field is silently introduced or dropped.
      const merged = structuredClone(baseline);
      merged.pki = { ...merged.pki, revocationBaseUrl: crl } as MachineConfig["pki"];

      const baseTier = modeToTier[baseline.stateKey?.mode ?? ""] ?? tiers[0];
      if (tier !== baseTier) {
        merged.stateKey = {
          ...merged.stateKey,
          mode: tierToMode[tier] ?? "",
        } as MachineConfig["stateKey"];
      }

      // A node with a hostname revocation URL needs its resolver to pass the
      // revocation preflight, so the resolver is only rewritten when the
      // operator actually changed it; otherwise the baseline network, with any
      // fields this form does not know about, goes back untouched.
      const nextNameservers = parseList(nameservers);
      const nextSearch = parseList(search);
      if (
        !sameList(nextNameservers, baseline.network?.nameservers ?? []) ||
        !sameList(nextSearch, baseline.network?.search ?? [])
      ) {
        merged.network = {
          ...merged.network,
          nameservers: nextNameservers,
          search: nextSearch,
        } as MachineConfig["network"];
      }

      const applied = await applyNodeConfig(node.name, merged);
      setResult(applied);
      // Refetch so the form reflects the node's committed config.
      await load();
    } catch (error_: unknown) {
      setApplyError(error_ instanceof Error ? error_.message : "Apply failed");
    } finally {
      setPending(false);
    }
  };

  if (loadError) {
    return (
      <p className="max-w-md font-mono text-sm text-destructive" role="alert">
        {loadError}
      </p>
    );
  }

  if (!baseline) {
    return <p className="max-w-md font-mono text-sm text-muted-foreground">Loading config…</p>;
  }

  return (
    <div className="max-w-md space-y-4">
      <label className="block space-y-1">
        <span className={label}>Revocation base URL (CRL/OCSP)</span>
        <input
          className={field}
          disabled={!isAdmin}
          onChange={(e) => setCrl(e.target.value)}
          value={crl}
        />
      </label>
      <label className="block space-y-1">
        <span className={label}>Key protection tier</span>
        <select
          className={field}
          disabled={!isAdmin}
          onChange={(e) => setTier(e.target.value)}
          value={tier}
        >
          {tiers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className={label}>DNS nameservers</span>
        <input
          className={field}
          disabled={!isAdmin}
          onChange={(e) => setNameservers(e.target.value)}
          placeholder="10.0.0.53, 10.0.1.53"
          value={nameservers}
        />
      </label>
      <label className="block space-y-1">
        <span className={label}>DNS search domains</span>
        <input
          className={field}
          disabled={!isAdmin}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="pki.example.org"
          value={search}
        />
      </label>

      {result ? (
        <div className="space-y-1 rounded-md border bg-secondary p-3">
          <p className="font-mono text-sm text-success">
            Config applied to {node.name} (generation {result.generation}).
          </p>
          {result.requiresReboot ? (
            <p className="font-mono text-xs text-warning" role="status">
              This change takes effect only after the node reboots.
            </p>
          ) : null}
        </div>
      ) : null}

      {applyError ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {applyError}
        </p>
      ) : null}

      {isAdmin ? (
        <Button disabled={pending} onClick={() => void submit()} type="button">
          {pending ? "Applying…" : "Apply"}
        </Button>
      ) : (
        <p className="font-mono text-xs text-muted-foreground">
          Read-only — applying config requires admin level.
        </p>
      )}
    </div>
  );
};

export const ConfigForm = ({ node }: { node: Node }) =>
  fleetMode() === "mock" ? <MockConfigDemo node={node} /> : <LiveConfigForm node={node} />;
