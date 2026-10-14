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

import type { InstallDisk } from "@cryptos-pki/api-client/cryptos/node/v1/node_pb";

import { create } from "@bufbuild/protobuf";
import { MachineConfigSchema } from "@cryptos-pki/api-client/cryptos/node/v1/config_pb";
import {
  Button,
  Field,
  FingerprintConfirm,
  Input,
  inputClasses,
  Notice,
  type Phase,
  PhaseRail,
} from "@cryptos-pki/ui";
import { useRef, useState } from "react";

import { useAuth } from "@/context/auth";
import {
  type AdoptionPreview,
  adoptNode,
  type AdoptPhase,
  AWAITING_FINGERPRINT,
  confirmAdoptionFingerprint,
  fetchParentAnchor,
  formatDiskSize,
  listInstallDisks,
  previewAdoption,
} from "@/lib/adopt";
import { parseList } from "@/lib/config";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { useNodes } from "@/lib/nodes";

// The same key-protection tiers the S5 config form offers, mapped to the
// node's StateKey.mode token so the initial config uses real values.
const tiers = ["nodeID (dev)", "TPM-sealed", "HSM"];
const tierToMode: Record<string, string> = {
  HSM: "kms",
  "nodeID (dev)": "nodeid",
  "TPM-sealed": "tpm",
};

// The manager's documented phases, in order, so the progress rail can show
// every step and mark those already passed. After the reboot the manager
// waits for the operator to confirm the installed node's fingerprint. A root
// then self-signs via the ceremony and reaches "established"; a subordinate
// skips the ceremony and ends at "awaiting-certificate", completed later by a
// subordinate enrollment.
const ROOT_PHASES = [
  "applying-config",
  "installing",
  "awaiting-reboot",
  "awaiting-fingerprint-confirmation",
  "ceremony",
  "established",
];
const SUBORDINATE_PHASES = [
  "applying-config",
  "installing",
  "awaiting-reboot",
  "awaiting-fingerprint-confirmation",
  "awaiting-certificate",
];

// adoptionPhases turns the manager's phase ids into the kit PhaseRail's Phase
// list: everything before the current one is done, the current one is current
// (or failed, if the adoption errored on it), and the rest are pending.
const adoptionPhases = (
  phases: string[],
  current: null | string,
  error: boolean,
  detail?: string,
): Phase[] => {
  const terminal = phases.at(-1);
  const currentIndex = current ? phases.indexOf(current) : -1;
  return phases.map((id, index) => {
    const passed = currentIndex > index || (currentIndex === index && current === terminal);
    const active = currentIndex === index && current !== terminal;
    let state: Phase["state"] = "pending";
    if (passed) state = "done";
    else if (active) state = error ? "failed" : "current";
    return { detail: active ? detail : undefined, id, label: id, state };
  });
};

export const AdoptPage = () => {
  const { operator } = useAuth();
  const isAdmin = operator?.level === "admin";

  const [endpoint, setEndpoint] = useState("");
  const [preview, setPreview] = useState<AdoptionPreview | null>(null);
  const [confirmedPin, setConfirmedPin] = useState<null | string>(null);

  const [nodeName, setNodeName] = useState("");
  const [role, setRole] = useState("root");
  const [netInterface, setNetInterface] = useState("eth0");
  const [address, setAddress] = useState("");
  const [gateway, setGateway] = useState("");
  const [nameservers, setNameservers] = useState("");
  const [search, setSearch] = useState("");
  const [rootCn, setRootCn] = useState("");
  const [validityYears, setValidityYears] = useState("10");
  const [disk, setDisk] = useState("");
  const [crl, setCrl] = useState("");
  const [tier, setTier] = useState(tiers[0]);

  // Install disks discovered on the maintenance node (fetched on fingerprint
  // confirm), so the operator picks a real device instead of guessing a path.
  const [disks, setDisks] = useState<InstallDisk[]>([]);
  const [disksBusy, setDisksBusy] = useState(false);
  const [disksError, setDisksError] = useState("");

  // Subordinate (intermediate/issuing) adoption: the operator picks a parent
  // node and we embed its CA certificate as the trust anchor. Established nodes
  // are the eligible parents; the anchor is fetched on selection.
  const isSubordinate = role !== "root";
  const parents = useNodes().filter((n) => n.identityState === "ESTABLISHED");
  const [parentName, setParentName] = useState("");
  const [parentAnchor, setParentAnchor] = useState("");
  const [parentBusy, setParentBusy] = useState(false);

  const [phase, setPhase] = useState<AdoptPhase | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // The installed node's fingerprint the manager is waiting on, cleared once
  // the operator confirms it or the adoption moves on.
  const [confirming, setConfirming] = useState(false);
  const [installedConfirmed, setInstalledConfirmed] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const selectParent = async (name: string) => {
    setParentName(name);
    setParentAnchor("");
    if (!name) return;
    setError("");
    setParentBusy(true);
    try {
      setParentAnchor(await fetchParentAnchor(name));
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "Could not load the parent certificate");
    } finally {
      setParentBusy(false);
    }
  };

  // confirmPin pins the fingerprint and discovers the node's install disks so
  // the operator picks a real device. Disk discovery is best-effort: on failure
  // the form falls back to manual entry.
  const confirmPin = async (pin: string) => {
    setConfirmedPin(pin);
    setDisksBusy(true);
    setDisksError("");
    try {
      const found = await listInstallDisks(endpoint, pin);
      setDisks(found);
      if (found.length > 0) {
        setDisk(found[0].path);
      }
    } catch (error_: unknown) {
      setDisks([]);
      setDisksError(fleetErrorMessage(error_, "Disk discovery failed."));
    } finally {
      setDisksBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Adopt node</h1>
        <p className="font-mono text-sm text-muted-foreground">
          Adopting a node requires admin level.
        </p>
      </section>
    );
  }

  const runPreview = async () => {
    setError("");
    setPending(true);
    setPreview(null);
    setConfirmedPin(null);
    try {
      setPreview(await previewAdoption(endpoint));
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "Preview failed");
    } finally {
      setPending(false);
    }
  };

  const confirmInstalled = async (step: AdoptPhase) => {
    setError("");
    setConfirming(true);
    try {
      await confirmAdoptionFingerprint(step.adoptionId, step.presentedCertSha256);
      setInstalledConfirmed(true);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : "Fingerprint confirmation failed");
    } finally {
      setConfirming(false);
    }
  };

  // cancelAdoption ends the stream, which stops the adoption on the manager
  // before it trusts or records anything.
  const cancelAdoption = () => {
    setCancelled(true);
    abortRef.current?.abort();
  };

  const runAdopt = async () => {
    if (!confirmedPin) return;
    setError("");
    setPending(true);
    setPhase(null);
    setInstalledConfirmed(false);
    setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    // The initial config the manager applies to the maintenance node. Only the
    // fields the operator set are populated; the node fills its build-time
    // defaults for the rest.
    // A root self-signs, so it carries root_validity_years and no parent. A
    // subordinate's validity comes from the parent's sub-CA profile at signing
    // time, so it omits root_validity_years and instead pins the parent anchor.
    // A subordinate is NOT a CA until its enrollment is signed, so it carries no
    // revocation config at adopt time (that is set later, once it is
    // established, via apply-config); sending it now stalls first-boot.
    const pki = isSubordinate
      ? {
          parent: { caCertPem: parentAnchor },
          rootKeyAlg: "ECDSA-P384",
          rootSubject: { commonName: rootCn },
        }
      : {
          revocationBaseUrl: crl,
          rootKeyAlg: "ECDSA-P384",
          rootSubject: { commonName: rootCn },
          rootValidityYears: Number(validityYears) || 10,
        };
    const config = create(MachineConfigSchema, {
      apiVersion: "cryptos.dev/v1alpha1",
      install: { disk },
      kind: "MachineConfig",
      metadata: { name: nodeName },
      network: {
        address,
        gateway,
        interface: netInterface,
        nameservers: parseList(nameservers),
        search: parseList(search),
      },
      pki,
      role: { kind: role },
      stateKey: { mode: tierToMode[tier] ?? "" },
    });
    try {
      for await (const step of adoptNode(endpoint, confirmedPin, config, controller.signal)) {
        setPhase(step);
      }
    } catch (error_: unknown) {
      if (controller.signal.aborted) {
        setError("Adoption cancelled. The manager trusted and recorded nothing for this node.");
      } else {
        setError(error_ instanceof Error ? error_.message : "Adoption failed");
      }
    } finally {
      setPending(false);
    }
  };

  const awaitingInstalled =
    phase?.phase === AWAITING_FINGERPRINT && !phase.done && !installedConfirmed && !cancelled;

  const established = phase?.done && phase.phase === "established";
  const awaitingCert = phase?.done && phase.phase === "awaiting-certificate";

  return (
    <section className="max-w-xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Adopt node</h1>
        <p className="text-sm text-muted-foreground">
          Provision a new node from maintenance mode: confirm its identity, set its initial config,
          and let the manager orchestrate the enrollment ceremony.
        </p>
      </div>

      {/* Step 1: endpoint + trust-on-first-use fingerprint confirmation. */}
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Step 1 — maintenance endpoint
        </h2>
        <Field label="Endpoint (host:port)">
          <Input
            disabled={!!confirmedPin}
            onChange={(e) => setEndpoint(e.target.value)}
            value={endpoint}
          />
        </Field>
        {confirmedPin ? null : (
          <Button
            disabled={pending || !endpoint.trim()}
            onClick={() => void runPreview()}
            size="sm"
          >
            {pending ? "Contacting…" : "Preview"}
          </Button>
        )}

        {preview && !confirmedPin ? (
          <FingerprintConfirm
            actions={
              <Button onClick={() => void confirmPin(preview.certSha256)} size="sm">
                Confirm fingerprint
              </Button>
            }
            fingerprint={preview.certSha256}
            fingerprintLabel="sha256"
            subject={[["subject", preview.subject]]}
            title="First contact"
            tone="warning"
          >
            Confirm this is the node you expect before trusting it.
          </FingerprintConfirm>
        ) : null}

        {confirmedPin ? (
          <Notice role="status" tone="success">
            Fingerprint pinned for this adoption.
          </Notice>
        ) : null}
      </div>

      {/* Step 2: initial config + orchestrated adoption. */}
      {confirmedPin ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Step 2 — initial config
          </h2>
          <Field label="Node name">
            <Input onChange={(e) => setNodeName(e.target.value)} value={nodeName} />
          </Field>
          <Field label="Role">
            <select className={inputClasses} onChange={(e) => setRole(e.target.value)} value={role}>
              {["root", "intermediate", "issuing"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>

          {/* A subordinate is signed by a parent CA already in the fleet: pick it
              and pin its certificate as the trust anchor. */}
          {isSubordinate ? (
            <Field label="Parent CA (signs this node)">
              <select
                className={inputClasses}
                onChange={(e) => void selectParent(e.target.value)}
                value={parentName}
              >
                <option value="">Select a parent…</option>
                {parents.map((n) => (
                  <option key={n.name} value={n.name}>
                    {n.cn ? `${n.name} — ${n.cn}` : n.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {isSubordinate && parentBusy ? (
            <span className="font-mono text-[11px] text-muted-foreground" role="status">
              Loading parent certificate…
            </span>
          ) : null}
          {isSubordinate && parentAnchor && !parentBusy ? (
            <span className="font-mono text-[11px] text-success" role="status">
              Parent certificate pinned as the trust anchor.
            </span>
          ) : null}
          {isSubordinate && parents.length === 0 ? (
            <span className="font-mono text-[11px] text-warning">
              No established parent CA in the fleet yet — adopt a root first.
            </span>
          ) : null}

          <Field label={isSubordinate ? "CA subject common name" : "Root CA subject common name"}>
            <Input onChange={(e) => setRootCn(e.target.value)} value={rootCn} />
          </Field>
          {isSubordinate ? null : (
            <Field label="Root validity (years)">
              <Input onChange={(e) => setValidityYears(e.target.value)} value={validityYears} />
            </Field>
          )}
          <Field label="Network interface">
            <Input onChange={(e) => setNetInterface(e.target.value)} value={netInterface} />
          </Field>
          <Field label="Address (CIDR)">
            <Input
              onChange={(e) => setAddress(e.target.value)}
              placeholder="10.0.0.10/24"
              value={address}
            />
          </Field>
          <Field label="Gateway">
            <Input
              onChange={(e) => setGateway(e.target.value)}
              placeholder="10.0.0.1"
              value={gateway}
            />
          </Field>
          {/* A CA whose revocation base URL is a hostname cannot pass its
              revocation preflight without a resolver. */}
          <Field label="DNS nameservers">
            <Input
              onChange={(e) => setNameservers(e.target.value)}
              placeholder="10.0.0.53, 10.0.1.53"
              value={nameservers}
            />
          </Field>
          <Field label="DNS search domains">
            <Input
              onChange={(e) => setSearch(e.target.value)}
              placeholder="pki.example.org"
              value={search}
            />
          </Field>
          {/* The install disk is discovered from the node so the operator picks
              a real device; manual entry remains as a fallback when discovery
              returns nothing. */}
          <Field label="Install disk">
            {disks.length > 0 ? (
              <select
                className={inputClasses}
                onChange={(e) => setDisk(e.target.value)}
                value={disk}
              >
                {disks.map((d) => (
                  <option key={d.path} value={d.path}>
                    {d.path} — {formatDiskSize(d.sizeBytes)}
                    {d.model ? ` — ${d.model}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                onChange={(e) => setDisk(e.target.value)}
                placeholder={disksBusy ? "Discovering disks…" : "/dev/nvme0n1"}
                value={disk}
              />
            )}
          </Field>
          {disksError ? (
            <Notice role="status" tone="warning">
              Could not list the node&apos;s disks: {disksError} Enter the install disk by hand.
            </Notice>
          ) : null}
          {/* Revocation is a CA responsibility, so it is offered only for a root
              at adopt time. A subordinate is not a CA until its enrollment is
              signed; its revocation base URL is set afterward via apply-config. */}
          {isSubordinate ? null : (
            <Field label="Revocation base URL (CRL/OCSP)">
              <Input onChange={(e) => setCrl(e.target.value)} value={crl} />
            </Field>
          )}
          <Field label="Key protection tier">
            <select className={inputClasses} onChange={(e) => setTier(e.target.value)} value={tier}>
              {tiers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          {phase ? (
            <PhaseRail
              label="Adoption progress"
              phases={adoptionPhases(
                isSubordinate ? SUBORDINATE_PHASES : ROOT_PHASES,
                phase.phase,
                !!error,
                phase.detail,
              )}
            />
          ) : null}

          {/* The installed node presents a new certificate after its reboot.
              Nothing links it to the maintenance fingerprint confirmed in step
              1, so the operator checks it against the node's console before
              the manager trusts it. */}
          {awaitingInstalled && phase ? (
            <FingerprintConfirm
              actions={
                <>
                  <Button
                    disabled={confirming}
                    onClick={() => void confirmInstalled(phase)}
                    size="sm"
                  >
                    {confirming ? "Confirming…" : "Fingerprint matches the console"}
                  </Button>
                  <Button
                    disabled={confirming}
                    onClick={cancelAdoption}
                    size="sm"
                    variant="destructive"
                  >
                    Does not match: cancel adoption
                  </Button>
                </>
              }
              fingerprint={phase.presentedCertSha256}
              fingerprintLabel="sha256"
              title="Confirm the installed node"
              tone="warning"
            >
              The node rebooted into its installed system with a new certificate. Compare this
              fingerprint with the Mgmt SHA-256 line on the node&apos;s console before trusting it.
            </FingerprintConfirm>
          ) : null}

          {(() => {
            if (established) {
              return (
                <Notice tone="success">
                  {nodeName || "The node"} is established and linked to the fleet.
                </Notice>
              );
            }
            if (awaitingCert) {
              return (
                <Notice tone="success">
                  {nodeName || "The node"} is provisioned and awaiting a parent-signed certificate.
                  Complete it from Enrollment (create a subordinate enrollment with parent{" "}
                  {parentName || "the selected CA"}).
                </Notice>
              );
            }
            return (
              <Button
                disabled={
                  pending || !nodeName.trim() || !disk.trim() || (isSubordinate && !parentAnchor)
                }
                onClick={() => void runAdopt()}
                size="sm"
              >
                {pending ? "Adopting…" : "Adopt node"}
              </Button>
            );
          })()}
        </div>
      ) : null}

      {error ? <Notice tone="danger">{error}</Notice> : null}
    </section>
  );
};
