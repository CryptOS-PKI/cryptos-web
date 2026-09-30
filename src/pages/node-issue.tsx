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

import { IssueForm } from "@/components/issue-form";
import { Button } from "@/components/ui/button";
import { canIssue, type Cert } from "@/lib/certs";
import { useNode } from "@/lib/nodes";

export const NodeIssuePage = () => {
  const { name } = useParams<{ name: string }>();
  const node = useNode(name);
  const [issued, setIssued] = useState<Cert | null>(null);
  // Remount key: bumping it drops the form's issued/export state so "Issue
  // another" starts from a clean form (and a fresh, unexportable key).
  const [formKey, setFormKey] = useState(0);

  if (!node || canIssue(node).length === 0) {
    return <Navigate replace to={`/nodes/${name}`} />;
  }

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Issue a certificate</h1>
        <p className="font-mono text-sm text-muted-foreground">from {node.name}</p>
      </div>

      <IssueForm key={formKey} node={node} onIssued={setIssued} />

      {issued ? (
        <div className="flex max-w-md gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={`/nodes/${node.name}/certs/${issued.serial}`}>View certificate</Link>
          </Button>
          <Button
            onClick={() => {
              setIssued(null);
              setFormKey((k) => k + 1);
            }}
            size="sm"
            variant="outline"
          >
            Issue another
          </Button>
        </div>
      ) : null}

      <Button asChild variant="outline">
        <Link to={`/nodes/${node.name}`}>Back to node</Link>
      </Button>
    </section>
  );
};
