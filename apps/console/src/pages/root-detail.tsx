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

import { Button, Card, FieldTile, FieldTiles } from "@cryptos-pki/ui";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { ConfigForm } from "@/components/config-form";
import { RekeyWizard } from "@/components/rekey-wizard";
import { RenameNodeDialog } from "@/components/rename-node-dialog";
import { useOptionalAuth } from "@/context/auth";
import { useNode } from "@/lib/nodes";

const Panel = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <Card className="w-full overflow-hidden">
    <div className="border-b px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
      {label}
    </div>
    <div className="p-4">{children}</div>
  </Card>
);

export const RootDetailPage = () => {
  const { name } = useParams<{ name: string }>();
  const node = useNode(name);
  const navigate = useNavigate();
  const isAdmin = useOptionalAuth()?.operator?.level === "admin";
  const [renaming, setRenaming] = useState(false);

  if (!node || node.role !== "root") {
    return <Navigate replace to="/root" />;
  }

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{node.name}</h1>
          <p className="font-mono text-sm text-muted-foreground">Root CA · {node.address}</p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setRenaming(true)} size="sm" variant="outline">
            {"Rename…"}
          </Button>
        ) : null}
      </div>

      {renaming ? (
        <RenameNodeDialog
          node={node}
          onClose={() => setRenaming(false)}
          onRenamed={(newName) => navigate(`/root/${newName}`, { replace: true })}
        />
      ) : null}

      <Panel label="Connection">
        <FieldTiles columns={2}>
          <FieldTile label="mTLS endpoint" value={node.connection?.endpoint ?? null} />
          <FieldTile label="fm client identity" value={node.connection?.mtlsIdentity ?? null} />
        </FieldTiles>
      </Panel>

      <Panel label="Config">
        <ConfigForm node={node} />
      </Panel>

      <Panel label="Re-key / ceremony">
        <RekeyWizard node={node} />
      </Panel>

      <Button asChild variant="outline">
        <Link to="/root">Back to roots</Link>
      </Button>
    </section>
  );
};
