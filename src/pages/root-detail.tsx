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

import { Link, Navigate, useParams } from "react-router-dom";

import { ConfigForm } from "@/components/config-form";
import { RekeyWizard } from "@/components/rekey-wizard";
import { Button } from "@/components/ui/button";
import { useNode } from "@/lib/nodes";

const Panel = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="w-full rounded-xl border bg-card">
    <div className="border-b px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
      {label}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Field = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="flex flex-col gap-1 rounded-lg border bg-secondary px-3 py-2.5">
    <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    <span className="break-all font-mono text-xs">{children}</span>
  </div>
);

export const RootDetailPage = () => {
  const { name } = useParams<{ name: string }>();
  const node = useNode(name);

  if (!node || node.role !== "root") {
    return <Navigate replace to="/root" />;
  }

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{node.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">Root CA · {node.address}</p>
      </div>

      <Panel label="Connection">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="mTLS endpoint">{node.connection?.endpoint ?? "\u2014"}</Field>
          <Field label="fm client identity">{node.connection?.mtlsIdentity ?? "\u2014"}</Field>
        </div>
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
