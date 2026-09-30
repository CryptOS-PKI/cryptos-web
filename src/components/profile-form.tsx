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

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import {
  type CertProfile,
  createProfile,
  emptySans,
  emptySubject,
  EXT_KEY_USAGE_OPTIONS,
  KEY_ALG_OPTIONS,
  KEY_USAGE_OPTIONS,
  type ProfileExtension,
  type ProfileSans,
  updateProfile,
} from "@/lib/profiles";
import { cn } from "@/lib/utils";

const field = "w-full rounded-md border bg-card px-3 py-2 font-mono text-sm";
const label = "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

const empty: CertProfile = {
  extKeyUsage: [],
  extraExtensions: [],
  isCA: false,
  keyAlg: "ECDSA-P384",
  keyUsage: ["digital_signature"],
  name: "",
  sans: emptySans(),
  subject: emptySubject(),
  validityDays: 365,
};

const toggle = (list: string[], value: string): string[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

// Typed SAN inputs are edited as newline/comma-separated text and normalized to
// a trimmed, non-empty list.
const parseList = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const CheckGroup = ({
  label: groupLabel,
  onToggle,
  options,
  selected,
}: {
  label: string;
  onToggle: (v: string) => void;
  options: string[];
  selected: string[];
}) => (
  <div className="space-y-1">
    <span className={label}>{groupLabel}</span>
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          className={cn(
            "rounded-md border px-2.5 py-1 font-mono text-xs",
            selected.includes(o)
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary",
          )}
          key={o}
          onClick={() => onToggle(o)}
          type="button"
        >
          {o}
        </button>
      ))}
    </div>
  </div>
);

const SanInput = ({
  category,
  onChange,
  values,
}: {
  category: keyof ProfileSans;
  onChange: (next: string[]) => void;
  values: string[];
}) => (
  <label className="block space-y-1">
    <span className={label}>{category.toUpperCase()} SANs</span>
    <input
      aria-label={`${category} SANs`}
      className={field}
      onChange={(e) => onChange(parseList(e.target.value))}
      placeholder="comma or newline separated"
      value={values.join(", ")}
    />
  </label>
);

export const ProfileForm = ({
  initial,
  mode,
  onDone,
}: {
  initial?: CertProfile;
  mode: "create" | "edit";
  onDone: (name: string) => void;
}) => {
  const { operator } = useAuth();
  const isAdmin = operator?.level === "admin";

  const [p, setP] = useState<CertProfile>(initial ?? empty);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const setSan = (category: keyof ProfileSans, next: string[]) =>
    setP({ ...p, sans: { ...p.sans, [category]: next } });

  const setExtension = (i: number, patch: Partial<ProfileExtension>) =>
    setP({
      ...p,
      extraExtensions: p.extraExtensions.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    });

  const addExtension = () =>
    setP({
      ...p,
      extraExtensions: [...p.extraExtensions, { critical: false, oid: "", value: "" }],
    });

  const removeExtension = (i: number) =>
    setP({ ...p, extraExtensions: p.extraExtensions.filter((_, idx) => idx !== i) });

  const submit = async () => {
    setError("");
    if (!p.name.trim()) {
      setError("Name is required.");
      return;
    }
    setPending(true);
    try {
      const res = mode === "create" ? await createProfile(p) : await updateProfile(p.name, p);
      if (!res.ok) {
        setError(res.reason ?? "Could not save profile.");
        return;
      }
      onDone(p.name);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      <label className="block space-y-1">
        <span className={label}>Name</span>
        <input
          className={field}
          disabled={mode === "edit" || !isAdmin}
          onChange={(e) => setP({ ...p, name: e.target.value })}
          value={p.name}
        />
      </label>

      <label className="block space-y-1">
        <span className={label}>Key algorithm</span>
        <select
          className={field}
          disabled={!isAdmin}
          onChange={(e) => setP({ ...p, keyAlg: e.target.value })}
          value={p.keyAlg}
        >
          {KEY_ALG_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className={label}>Validity (days)</span>
        <input
          aria-label="Validity (days)"
          className={field}
          disabled={!isAdmin}
          onChange={(e) => setP({ ...p, validityDays: Number(e.target.value) })}
          type="number"
          value={p.validityDays}
        />
      </label>

      <fieldset className="space-y-2 rounded-md border p-3">
        <legend className={label}>Subject</legend>
        <label className="block space-y-1">
          <span className={label}>Common name</span>
          <input
            aria-label="Common name"
            className={field}
            disabled={!isAdmin}
            onChange={(e) => setP({ ...p, subject: { ...p.subject, commonName: e.target.value } })}
            value={p.subject.commonName}
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>Organization</span>
          <input
            aria-label="Organization"
            className={field}
            disabled={!isAdmin}
            onChange={(e) =>
              setP({ ...p, subject: { ...p.subject, organization: e.target.value } })
            }
            value={p.subject.organization}
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>Country</span>
          <input
            aria-label="Country"
            className={field}
            disabled={!isAdmin}
            onChange={(e) => setP({ ...p, subject: { ...p.subject, country: e.target.value } })}
            value={p.subject.country}
          />
        </label>
      </fieldset>

      <label className="flex items-center gap-2 font-mono text-sm">
        <input
          checked={p.isCA}
          disabled={!isAdmin}
          onChange={(e) => setP({ ...p, isCA: e.target.checked })}
          type="checkbox"
        />
        CA certificate (basic constraints)
      </label>

      {p.isCA ? (
        <label className="block space-y-1">
          <span className={label}>Path length</span>
          <input
            aria-label="Path length"
            className={field}
            disabled={!isAdmin}
            onChange={(e) => setP({ ...p, pathLen: Number(e.target.value) })}
            type="number"
            value={p.pathLen ?? 0}
          />
        </label>
      ) : null}

      <CheckGroup
        label="Key usage"
        onToggle={(v) => setP({ ...p, keyUsage: toggle(p.keyUsage, v) })}
        options={KEY_USAGE_OPTIONS}
        selected={p.keyUsage}
      />
      <CheckGroup
        label="Extended key usage"
        onToggle={(v) => setP({ ...p, extKeyUsage: toggle(p.extKeyUsage, v) })}
        options={EXT_KEY_USAGE_OPTIONS}
        selected={p.extKeyUsage}
      />

      <fieldset className="space-y-2 rounded-md border p-3">
        <legend className={label}>Subject alternative names</legend>
        <SanInput category="dns" onChange={(v) => setSan("dns", v)} values={p.sans.dns} />
        <SanInput category="ip" onChange={(v) => setSan("ip", v)} values={p.sans.ip} />
        <SanInput category="email" onChange={(v) => setSan("email", v)} values={p.sans.email} />
        <SanInput category="uri" onChange={(v) => setSan("uri", v)} values={p.sans.uri} />
      </fieldset>

      <fieldset className="space-y-2 rounded-md border p-3">
        <legend className={label}>Extra extensions</legend>
        {p.extraExtensions.map((ext, i) => (
          <div className="space-y-1 rounded-md border bg-card p-2" key={i}>
            <input
              aria-label={`Extension ${i + 1} OID`}
              className={field}
              disabled={!isAdmin}
              onChange={(e) => setExtension(i, { oid: e.target.value })}
              placeholder="OID, e.g. 1.3.6.1.5.5.7.1.1"
              value={ext.oid}
            />
            <input
              aria-label={`Extension ${i + 1} value`}
              className={field}
              disabled={!isAdmin}
              onChange={(e) => setExtension(i, { value: e.target.value })}
              placeholder="DER value (base64)"
              value={ext.value}
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-mono text-xs">
                <input
                  checked={ext.critical}
                  disabled={!isAdmin}
                  onChange={(e) => setExtension(i, { critical: e.target.checked })}
                  type="checkbox"
                />
                critical
              </label>
              {isAdmin ? (
                <Button
                  onClick={() => removeExtension(i)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {isAdmin ? (
          <Button onClick={addExtension} size="sm" type="button" variant="outline">
            Add extension
          </Button>
        ) : null}
      </fieldset>

      {error ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {isAdmin ? (
        <Button disabled={pending} onClick={() => void submit()} type="button">
          {pending ? "Saving…" : "Save"}
        </Button>
      ) : (
        <p className="font-mono text-xs text-muted-foreground">
          Read-only — editing profiles requires admin level.
        </p>
      )}
    </div>
  );
};
