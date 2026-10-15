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

import { Button, FieldTile, FieldTiles } from "@cryptos-pki/ui";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { Node } from "@/lib/mock";

import { DecommissionDialog } from "@/components/decommission-dialog";
import { EscrowExportDialog } from "@/components/escrow-export-dialog";
import { EscrowImportDialog } from "@/components/escrow-import-dialog";
import { IdentityBadge } from "@/components/identity-badge";
import { RebootDialog } from "@/components/reboot-dialog";
import { RenameNodeDialog } from "@/components/rename-node-dialog";
import { useOptionalAuth } from "@/context/auth";
import { canIssue } from "@/lib/certs";
import { roleLabels } from "@/lib/fleet/labels";

const fleetManagerText = (node: Node): string => {
  const fm = node.fleetManager;
  if (!fm.linked) return `REVOKED · ${fm.note ?? "peer cert pulled"}`;
  if (fm.peerCertDays !== undefined) return `LINKED · peer cert ${fm.peerCertDays}d`;
  return "LINKED";
};

export const NodeDetailPanel = ({
  node,
  onRenamed,
}: {
  node: Node;
  /** Called with the name after a successful rename (#87), so the caller can
   * move its own URL and any other name-keyed state -- the fleet store
   * updates itself, but nothing else does. */
  onRenamed: (newName: string) => void;
}) => {
  const isAdmin = useOptionalAuth()?.operator?.level === "admin";
  const [dialog, setDialog] = useState<
    "decommission" | "export" | "import" | "reboot" | "rename" | null
  >(null);

  return (
    <div className="p-4">
      <div className="text-lg font-bold">{node.name}</div>
      <div className="mt-0.5 font-mono text-xs text-muted-foreground">
        {node.address} · {roleLabels[node.role]}
      </div>

      {/* Fixed field set in a fixed grid — every property always renders in the
          same cell (em-dash when absent), so nothing shifts between nodes. */}
      <FieldTiles className="mt-4" columns={4}>
        <FieldTile
          label="identity"
          mono={false}
          value={<IdentityBadge state={node.identityState} />}
        />
        <FieldTile label="issuer" value={node.issuer} />
        <FieldTile label="subject cn" value={node.cn} />
        <FieldTile label="issued / revoked" value={`${node.issued} / ${node.revoked}`} />
        <FieldTile label="tpm" value={node.tpm} />
        <FieldTile label="fleet manager" value={fleetManagerText(node)} />
        <FieldTile label="boot count" value={node.bootCount} />
        <FieldTile label="uptime" value={node.uptime} />
        <FieldTile
          full
          label="crl"
          value={node.crl ? <span className="text-primary">{node.crl}</span> : null}
        />
        <FieldTile
          full
          label="ocsp"
          value={node.ocsp ? <span className="text-primary">{node.ocsp}</span> : null}
        />
      </FieldTiles>

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
        <Button
          lockedReason={isAdmin ? undefined : "Needs the admin role"}
          onClick={() => setDialog("rename")}
          size="sm"
          variant="outline"
        >
          {"Rename\u2026"}
        </Button>
        <Button
          lockedReason={isAdmin ? undefined : "Needs the admin role"}
          onClick={() => setDialog("export")}
          size="sm"
          variant="outline"
        >
          {"Export key\u2026"}
        </Button>
        <Button
          lockedReason={isAdmin ? undefined : "Needs the admin role"}
          onClick={() => setDialog("import")}
          size="sm"
          variant="outline"
        >
          {"Import key\u2026"}
        </Button>
        <Button
          lockedReason={isAdmin ? undefined : "Needs the admin role"}
          onClick={() => setDialog("decommission")}
          size="sm"
          variant="destructive"
        >
          {"Decommission\u2026"}
        </Button>
        <Button
          lockedReason={isAdmin ? undefined : "Needs the admin role"}
          onClick={() => setDialog("reboot")}
          size="sm"
          variant={node.rebootRequired ? "default" : "outline"}
        >
          {node.rebootRequired ? "Reboot needed\u2026" : "Reboot\u2026"}
        </Button>
      </div>

      {dialog === "rename" ? (
        <RenameNodeDialog node={node} onClose={() => setDialog(null)} onRenamed={onRenamed} />
      ) : null}
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
      {dialog === "reboot" ? (
        <RebootDialog
          caCn={node.cn}
          nodeName={node.name}
          onClose={() => setDialog(null)}
          onDone={() => {}}
          rebootRequired={Boolean(node.rebootRequired)}
        />
      ) : null}
    </div>
  );
};
