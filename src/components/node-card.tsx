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

import { Link } from "react-router-dom";

import { IdentityBadge } from "@/components/identity-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { type Node, roleLabels } from "@/lib/mock";

export const NodeCard = ({ node }: { node: Node }) => {
  const isRoot = node.role === "root";

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="font-mono text-base">
              <Link className="hover:text-primary" to={`/nodes/${node.name}`}>
                {node.name}
              </Link>
            </CardTitle>
            <CardDescription className="font-mono">{roleLabels[node.role]}</CardDescription>
          </div>
          <IdentityBadge state={node.identityState} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        <div className="flex justify-between font-mono">
          <span className="text-muted-foreground">address</span>
          <span>{node.address}</span>
        </div>
        <div className="flex justify-between font-mono">
          <span className="text-muted-foreground">issuer</span>
          <span>{node.issuer}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-mono">
          <span className="text-muted-foreground">issued</span>
          <span>{node.issued}</span>
        </div>
        <div className="flex justify-between font-mono">
          <span className="text-muted-foreground">revoked</span>
          <span>{node.revoked}</span>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          disabled={isRoot}
          size="sm"
          title={isRoot ? "Root nodes do not issue leaves" : undefined}
        >
          Issue leaf
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to={`/nodes/${node.name}`}>View chain</Link>
        </Button>
        <Button disabled={node.issued === 0} size="sm" variant="destructive">
          Revoke
        </Button>
      </CardFooter>
    </Card>
  );
};
