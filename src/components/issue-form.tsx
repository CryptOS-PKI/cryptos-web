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

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { canIssue, type Cert, type CertKind, issueCert } from "@/lib/certs";
import { parseCsr, type ParsedCsr } from "@/lib/crypto/csr";
import {
  exportEncryptedKey,
  generateLeafKeyAndCSR,
  generateStrongPassphrase,
  MIN_PASSPHRASE_LENGTH,
  toPemEncryptedKey,
} from "@/lib/crypto/leaf-key";
import { fleetMode } from "@/lib/fleet/mode";
import { type Node } from "@/lib/mock";
import { getProfile, useProfiles } from "@/lib/profiles";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border bg-card px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring";

// download triggers a browser download of contents under filename without
// leaving a URL object behind.
const download = (filename: string, contents: BlobPart, type: string): void => {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
};

// KeyExport is the guarded, always-encrypted private-key export shown after a
// live issuance. The exported key is never plaintext: it requires a passphrase
// of at least MIN_PASSPHRASE_LENGTH characters (enforced again in
// exportEncryptedKey) and a two-step in-UI confirmation -- a "saved the
// passphrase" checkbox plus an explicit export click. No native popups.
const KeyExport = ({ privateKey, subjectCn }: { privateKey: CryptoKey; subjectCn: string }) => {
  const [passphrase, setPassphrase] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const longEnough = passphrase.length >= MIN_PASSPHRASE_LENGTH;

  const exportKey = () => {
    setPending(true);
    setError("");
    exportEncryptedKey(privateKey, passphrase)
      .then((der) => {
        download(`${subjectCn}.key.pem`, toPemEncryptedKey(der), "application/x-pem-file");
        setDone(true);
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : "Export failed");
      })
      .finally(() => setPending(false));
  };

  return (
    <div className="space-y-3 rounded-md border bg-card p-3">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        Export private key (always encrypted)
      </p>
      <label className="block space-y-1">
        <span className="font-mono text-[11px] text-muted-foreground">
          Passphrase (min {MIN_PASSPHRASE_LENGTH} characters)
        </span>
        <input
          className={field}
          onChange={(e) => {
            setPassphrase(e.target.value);
            setSaved(false);
            setDone(false);
          }}
          type="password"
          value={passphrase}
        />
      </label>
      <Button
        onClick={() => {
          setPassphrase(generateStrongPassphrase());
          setSaved(false);
          setDone(false);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        Generate strong passphrase
      </Button>
      {passphrase && !longEnough ? (
        <p className="font-mono text-xs text-destructive">
          Passphrase must be at least {MIN_PASSPHRASE_LENGTH} characters.
        </p>
      ) : null}
      <label className="flex items-center gap-2 font-mono text-xs">
        <input
          checked={saved}
          disabled={!longEnough}
          onChange={(e) => setSaved(e.target.checked)}
          type="checkbox"
        />
        <span>I have saved the passphrase somewhere safe</span>
      </label>
      {error ? (
        <p className="font-mono text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {done ? <p className="font-mono text-xs text-success">Encrypted key downloaded.</p> : null}
      <Button
        disabled={!longEnough || !saved || pending}
        onClick={exportKey}
        size="sm"
        type="button"
      >
        {pending ? "Exporting…" : "Export private key"}
      </Button>
    </div>
  );
};

export const IssueForm = ({ node, onIssued }: { node: Node; onIssued: (cert: Cert) => void }) => {
  const kinds = canIssue(node);
  const profiles = useProfiles();
  const [kind, setKind] = useState<CertKind>(kinds[0]);
  const [profileName, setProfileName] = useState("");
  const [subjectCn, setSubjectCn] = useState("");
  const [sans, setSans] = useState("");
  const [pathLen, setPathLen] = useState("0");
  const [validityDays, setValidityDays] = useState("90");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [issued, setIssued] = useState<Cert | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  // Where the key comes from. Generating here is the convenient path; pasting
  // is the necessary one -- an appliance such as VMware VMCA or AD CS
  // generates its own key and exposes no choice, so its operator arrives
  // holding a CSR (#88). It is also the only source for a live subordinate CA,
  // which the browser never generates a key for.
  const [source, setSource] = useState<"generate" | "paste">("generate");
  const [csrPem, setCsrPem] = useState("");
  const [parsed, setParsed] = useState<null | ParsedCsr>(null);
  const [parseError, setParseError] = useState("");

  // Parse as it is pasted so the operator sees what they are about to sign
  // before committing to it, rather than after the node refuses it.
  useEffect(() => {
    if (source !== "paste" || csrPem.trim() === "") {
      setParsed(null);
      setParseError("");

      return;
    }
    let cancelled = false;
    void parseCsr(csrPem)
      .then((p) => {
        if (cancelled) return;
        setParsed(p);
        setParseError("");
      })
      .catch((error_: unknown) => {
        if (cancelled) return;
        setParsed(null);
        setParseError(error_ instanceof Error ? error_.message : "Could not read that request");
      });

    return () => {
      cancelled = true;
    };
  }, [csrPem, source]);

  const submit = async () => {
    // Narrow once, here, so the rest of the function works with a value that
    // either is a parsed request or definitively is not.
    let pastedCsr: ParsedCsr | undefined;
    if (source === "paste") {
      if (!parsed) {
        setError(parseError || "Paste a certificate signing request first.");

        return;
      }
      pastedCsr = parsed;
    }
    // A pasted request carries its own subject and SANs; they are not the
    // operator's to retype, and disagreeing with the CSR would be ignored by
    // the signer anyway.
    const cn = pastedCsr ? pastedCsr.subjectCn : subjectCn.trim();
    if (!cn) {
      setError("Subject CN is required.");
      return;
    }
    const selected = profileName ? getProfile(profileName) : undefined;
    const defaultEku = kind === "leaf" ? ["serverAuth"] : [];
    const eku = selected ? selected.extKeyUsage : defaultEku;
    const sanList = pastedCsr
      ? pastedCsr.sans
      : sans
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    setError("");
    setPending(true);
    try {
      // The browser owns the leaf keypair: only a live leaf issuance generates
      // a key + CSR and offers the guarded export. Sub-CA issuance and the mock
      // path keep the fixture-only behavior.
      let csrDer: Uint8Array | undefined;
      let key: CryptoKey | null = null;
      if (pastedCsr) {
        // The requester holds the private key; there is nothing to export and
        // nothing of theirs ever reaches us.
        csrDer = pastedCsr.csrDer;
      } else if (fleetMode() !== "mock" && kind === "leaf") {
        const generated = await generateLeafKeyAndCSR({ sans: sanList, subjectCn: cn });
        csrDer = generated.csrDer;
        key = generated.privateKey;
      }

      const cert = await issueCert(node.name, {
        csrDer,
        eku,
        kind,
        pathLen: kind === "subordinate-ca" ? Number(pathLen) : undefined,
        profile: profileName || undefined,
        sans: sanList,
        subjectCn: cn,
        validityDays: Number(validityDays),
      });

      setIssued(cert);
      setPrivateKey(key);
      onIssued(cert);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "Issuance failed");
    } finally {
      setPending(false);
    }
  };

  if (issued) {
    return (
      <div className="max-w-md space-y-3">
        <div className="space-y-1 rounded-md border bg-secondary p-3">
          <p className="font-mono text-sm">
            Issued <span className="text-success">{issued.subjectCn}</span>
          </p>
          <p className="font-mono text-xs text-muted-foreground">serial {issued.serial}</p>
        </div>
        {privateKey ? <KeyExport privateKey={privateKey} subjectCn={issued.subjectCn} /> : null}
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      {kinds.length > 1 ? (
        <div className="flex gap-1.5">
          {kinds.map((k) => (
            <button
              className={cn(
                "rounded-md border px-3 py-1.5 font-mono text-xs",
                kind === k
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
              key={k}
              onClick={() => setKind(k)}
              type="button"
            >
              {k === "subordinate-ca" ? "Subordinate CA" : "Leaf"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-1.5">
        {(["generate", "paste"] as const).map((sourceOption) => (
          <button
            className={cn(
              "rounded-md border px-3 py-1.5 font-mono text-xs",
              source === sourceOption
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary",
            )}
            key={sourceOption}
            onClick={() => setSource(sourceOption)}
            type="button"
          >
            {sourceOption === "generate" ? "Generate a key here" : "Paste a CSR"}
          </button>
        ))}
      </div>

      {source === "paste" ? (
        <label className="block space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Certificate signing request
          </span>
          <textarea
            className={cn(field, "h-32 font-mono text-[11px]")}
            onChange={(e) => setCsrPem(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE REQUEST-----"
            spellCheck={false}
            value={csrPem}
          />
          {parseError ? <p className="text-xs text-destructive">{parseError}</p> : null}
          {parsed ? (
            <div className="space-y-0.5 rounded-md border bg-secondary p-2 font-mono text-[11px]">
              <p>
                subject <span className="text-foreground">{parsed.subjectCn}</span>
              </p>
              <p className="text-muted-foreground">key {parsed.keyDescription}</p>
              {parsed.sans.length > 0 ? (
                <p className="text-muted-foreground">sans {parsed.sans.join(", ")}</p>
              ) : null}
              {/* The CA refuses an RSA subject key below 3072 bits, which an
                  appliance can easily emit. Say so before signing is attempted. */}
              {parsed.keyBits !== undefined && parsed.keyBits < 3072 ? (
                <p className="text-destructive">
                  RSA {parsed.keyBits} is below this CA&apos;s 3072-bit minimum for subject keys and
                  will be refused.
                </p>
              ) : null}
            </div>
          ) : null}
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Profile
        </span>
        <select
          className={field}
          onChange={(e) => {
            const v = e.target.value;
            setProfileName(v);
            const p = getProfile(v);
            if (p) {
              setValidityDays(String(p.validityDays));
              if (p.isCA && p.pathLen !== undefined) setPathLen(String(p.pathLen));
            }
          }}
          value={profileName}
        >
          <option value="">(none)</option>
          {profiles.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {/* A pasted request carries its own subject and SANs, and the signer
          uses those -- so offering fields that would be ignored invites the
          operator to think they changed something. */}
      {source === "generate" ? (
        <label className="block space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Subject CN
          </span>
          <input
            className={field}
            onChange={(e) => setSubjectCn(e.target.value)}
            value={subjectCn}
          />
        </label>
      ) : null}

      {source === "generate" && kind === "leaf" ? (
        <label className="block space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            SANs (comma-separated)
          </span>
          <input className={field} onChange={(e) => setSans(e.target.value)} value={sans} />
        </label>
      ) : null}

      {/* Path length bounds the depth below a sub-CA, and is the CA's to set
          rather than the requester's -- so it is offered for a pasted request
          too, unlike the subject. */}
      {kind === "subordinate-ca" ? (
        <label className="block space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Path length
          </span>
          <input
            className={field}
            onChange={(e) => setPathLen(e.target.value)}
            type="number"
            value={pathLen}
          />
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Validity (days)
        </span>
        <input
          className={field}
          onChange={(e) => setValidityDays(e.target.value)}
          type="number"
          value={validityDays}
        />
      </label>

      {error ? <p className="font-mono text-xs text-destructive">{error}</p> : null}
      <Button disabled={pending} onClick={() => void submit()} type="button">
        {pending ? "Issuing…" : "Issue"}
      </Button>
    </div>
  );
};
