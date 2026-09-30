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
import { Link } from "react-router-dom";

import { DecommissionDialog } from "@/components/decommission-dialog";
import { EscrowExportDialog } from "@/components/escrow-export-dialog";
import { EscrowImportDialog } from "@/components/escrow-import-dialog";
import { IdentityBadge } from "@/components/identity-badge";
import { Button } from "@/components/ui/button";
import { useOptionalAuth } from "@/context/auth";
import { canIssue } from "@/lib/certs";
import { type Node, roleLabels } from "@/lib/mock";
import { cn } from "@/lib/utils";

// A single labeled field cell in the detail grid. `wide` spans two columns so a
// long value (CRL/OCSP URL) fills the full row width beneath the other fields.
const Field = ({
  children,
  label,
  mono = true,
  wide = false,
}: {
  children: React.ReactNode;
  label: string;
  mono?: boolean;
  wide?: boolean;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border bg-secondary px-3 py-2.5",
        wide && "col-span-2",
      )}
    >
      <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("break-all", mono ? "font-mono text-xs" : "text-sm")}>{children}</span>
    </div>
  );
};

const fleetManagerText = (node: Node): string => {
  const fm = node.fleetManager;
  if (!fm.linked) return `REVOKED · ${fm.note ?? "peer cert pulled"}`;
  if (fm.peerCertDays !== undefined) return `LINKED · peer cert ${fm.peerCertDays}d`;
  return "LINKED";
};

// The em-dash placeholder keeps a field's cell in place when a node lacks that
// property, so the panel never changes shape between nodes.
const DASH = "—";

export const NodeDetailPanel = ({ node }: { node: Node }) => {
  const isAdmin = useOptionalAuth()?.operator?.level === "admin";
  const [dialog, setDialog] = useState<"decommission" | "export" | "import" | null>(null);

  return (
    <div className="p-4">
      <div className="text-lg font-bold">{node.name}</div>
      <div className="mt-0.5 font-mono text-xs text-muted-foreground">
        {node.address} · {roleLabels[node.role]}
      </div>

      {/* Fixed field set in a fixed grid — every property always renders in the
          same cell (em-dash when absent), so nothing shifts between nodes. */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="identity" mono={false}>
          <IdentityBadge state={node.identityState} />
        </Field>
        <Field label="issuer">{node.issuer}</Field>
        <Field label="subject cn">{node.cn}</Field>
        <Field label="issued / revoked">
          {node.issued} / {node.revoked}
        </Field>
        <Field label="tpm">{node.tpm}</Field>
        <Field label="fleet manager">{fleetManagerText(node)}</Field>
        <Field label="boot count">{node.bootCount}</Field>
        <Field label="uptime">{node.uptime}</Field>
        <Field label="crl" wide>
          {node.crl ? <span className="text-primary">{node.crl}</span> : DASH}
        </Field>
        <Field label="ocsp" wide>
          {node.ocsp ? <span className="text-primary">{node.ocsp}</span> : DASH}
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canIssue(node).length > 0 ? (
          <Button asChild size="sm">
            <Link to={`/nodes/${node.name}/issue`}>{"Issue\u2026"}</Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link to={`/nodes/${node.name}`}>Open node</Link>
        </Button>
        {node.identityState === "REVOKED" ? null : (
          <Button asChild size="sm" variant="outline">
            <Link to={`/nodes/${node.name}/config`}>Config</Link>
          </Button>
        )}
        {node.identityState === "REVOKED" ? null : (
          <Button asChild size="sm" variant="outline">
            <Link to={`/nodes/${node.name}/profiles`}>Profiles</Link>
          </Button>
        )}
        {node.identityState === "REVOKED" ? null : (
          <Button asChild size="sm" variant="outline">
            <Link to={`/nodes/${node.name}/rekey`}>{"Re-key\u2026"}</Link>
          </Button>
        )}
        {isAdmin ? (
          <Button onClick={() => setDialog("export")} size="sm" variant="outline">
            {"Export key\u2026"}
          </Button>
        ) : null}
        {isAdmin ? (
          <Button onClick={() => setDialog("import")} size="sm" variant="outline">
            {"Import key\u2026"}
          </Button>
        ) : null}
        {isAdmin ? (
          <Button onClick={() => setDialog("decommission")} size="sm" variant="destructive">
            {"Decommission\u2026"}
          </Button>
        ) : null}
      </div>

      {dialog === "export" ? (
        <EscrowExportDialog nodeName={node.name} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "import" ? (
        <EscrowImportDialog nodeName={node.name} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "decommission" ? (
        <DecommissionDialog
          nodeName={node.name}
          onClose={() => setDialog(null)}
          onDone={() => {}}
          rootCaCn={node.cn}
        />
      ) : null}
    </div>
  );
};
