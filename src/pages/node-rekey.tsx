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

import { RekeyWizard } from "@/components/rekey-wizard";
import { Button } from "@/components/ui/button";
import { useNode } from "@/lib/nodes";

export const NodeRekeyPage = () => {
  const { name } = useParams<{ name: string }>();
  const node = useNode(name);

  if (!node || node.identityState === "REVOKED") {
    return <Navigate replace to={`/nodes/${name}`} />;
  }

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Re-key / ceremony</h1>
        <p className="font-mono text-sm text-muted-foreground">{node.name}</p>
      </div>
      <RekeyWizard node={node} />
      <Button asChild variant="outline">
        <Link to={`/nodes/${node.name}`}>Back to node</Link>
      </Button>
    </section>
  );
};
