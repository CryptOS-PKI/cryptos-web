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

import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { getCert } from "@/lib/certs";

const Row = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="flex flex-col gap-1 rounded-lg border bg-secondary px-3 py-2.5">
    <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    <span className="break-all font-mono text-xs">{children}</span>
  </div>
);

export const NodeCertDetailPage = () => {
  const { name, serial } = useParams<{ name: string; serial: string }>();
  const cert = serial ? getCert(serial) : undefined;

  if (!cert) {
    return (
      <section className="space-y-4">
        <h1 className="font-mono text-2xl font-bold tracking-tight">Certificate not found</h1>
        <Button asChild variant="outline">
          <Link to={`/nodes/${name}`}>Back to node</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{cert.subjectCn}</h1>
        <p className="font-mono text-sm text-muted-foreground">
          {cert.kind === "subordinate-ca" ? "Subordinate CA" : "Leaf"} certificate
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Row label="serial">{cert.serial}</Row>
        <Row label="status">{cert.status}</Row>
        <Row label="issuer node">{cert.issuerNodeName}</Row>
        <Row label="kind">{cert.kind}</Row>
        <Row label="not before">{cert.notBefore.slice(0, 10)}</Row>
        <Row label="not after">{cert.notAfter.slice(0, 10)}</Row>
        <Row label="eku">{cert.eku.join(", ") || "\u2014"}</Row>
        <Row label="sans">{cert.sans.join(", ") || "\u2014"}</Row>
        {cert.pathLen === undefined ? null : <Row label="path len">{cert.pathLen}</Row>}
        {cert.profile ? <Row label="profile">{cert.profile}</Row> : null}
        {cert.reason ? <Row label="revocation reason">{cert.reason}</Row> : null}
      </div>
      <Button asChild variant="outline">
        <Link to={`/nodes/${name}`}>Back to node</Link>
      </Button>
    </section>
  );
};
