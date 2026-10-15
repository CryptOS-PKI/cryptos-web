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
import { Link, useParams } from "react-router-dom";

import { getCert } from "@/lib/certs";

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
      <FieldTiles columns={4}>
        <FieldTile label="serial" value={cert.serial} />
        <FieldTile label="status" value={cert.status} />
        <FieldTile label="issuer node" value={cert.issuerNodeName} />
        <FieldTile label="kind" value={cert.kind} />
        <FieldTile label="not before" value={cert.notBefore.slice(0, 10)} />
        <FieldTile label="not after" value={cert.notAfter.slice(0, 10)} />
        <FieldTile full label="eku" value={cert.eku.length > 0 ? cert.eku : null} />
        <FieldTile full label="sans" value={cert.sans.length > 0 ? cert.sans : null} />
        {cert.pathLen === undefined ? null : <FieldTile label="path len" value={cert.pathLen} />}
        {cert.profile ? <FieldTile label="profile" value={cert.profile} /> : null}
        {cert.reason ? <FieldTile label="revocation reason" value={cert.reason} /> : null}
      </FieldTiles>
      <Button asChild variant="outline">
        <Link to={`/nodes/${name}`}>Back to node</Link>
      </Button>
    </section>
  );
};
