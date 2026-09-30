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

import { useAdapters } from "@/lib/adapters";
import { expiryClass, useAllCerts } from "@/lib/certs";
import { useEnrollments } from "@/lib/enrollment";
import { summarize } from "@/lib/mock";
import { useNodes } from "@/lib/nodes";
import { useProfiles } from "@/lib/profiles";
import { cn } from "@/lib/utils";

const Card = ({
  children,
  label,
  testId,
  to,
}: {
  children: React.ReactNode;
  label: string;
  testId: string;
  to: string;
}) => (
  <Link
    className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
    data-testid={testId}
    to={to}
  >
    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
      {label}
    </span>
    {children}
  </Link>
);

export const DashboardPage = () => {
  const nodes = useNodes();
  const certs = useAllCerts();
  const enrollments = useEnrollments();
  const adapters = useAdapters();
  const profiles = useProfiles();

  const health = summarize(nodes);
  const rootCount = nodes.filter((n) => n.role === "root").length;
  const expiring = certs.filter(
    (c) => c.status !== "REVOKED" && expiryClass(c) === "expiring",
  ).length;
  const expired = certs.filter(
    (c) => c.status !== "REVOKED" && expiryClass(c) === "expired",
  ).length;
  const validCerts = certs.filter((c) => c.status === "VALID").length;
  const pending = enrollments.filter((e) => e.status === "PENDING").length;
  const enabledAdapters = adapters.filter((a) => a.enabled).length;

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Fleet Manager at a glance</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card label="Fleet health" testId="card-fleet" to="/fleet">
          <div className="text-3xl font-bold">{nodes.length}</div>
          <div className="font-mono text-xs text-muted-foreground">
            {rootCount} root {"·"}{" "}
            <span className="text-success">{health.established} established</span> {"·"}{" "}
            <span className="text-warning">{health.pending} pending</span> {"·"}{" "}
            <span className="text-destructive">{health.revoked} revoked</span>
          </div>
        </Card>

        <Card label="Certificates" testId="card-certificates" to="/certificates">
          <div className="text-3xl font-bold">{validCerts}</div>
          <div className="font-mono text-xs text-muted-foreground">
            <span className={cn(expiring > 0 && "text-warning")}>{expiring} expiring</span> {"·"}{" "}
            <span className={cn(expired > 0 && "text-destructive")}>{expired} expired</span> {"·"}{" "}
            valid
          </div>
        </Card>

        <Card label="Enrollment" testId="card-enrollment" to="/enrollment">
          <div className={cn("text-3xl font-bold", pending > 0 && "text-warning")}>{pending}</div>
          <div className="font-mono text-xs text-muted-foreground">pending join requests</div>
        </Card>

        <Card label="Protocols" testId="card-protocols" to="/protocols">
          <div className="text-3xl font-bold">
            {enabledAdapters}
            <span className="text-base text-muted-foreground"> / {adapters.length}</span>
          </div>
          <div className="font-mono text-xs text-muted-foreground">active protocol adapters</div>
        </Card>

        <Card label="Profiles" testId="card-profiles" to="/profiles">
          <div className="text-3xl font-bold">{profiles.length}</div>
          <div className="font-mono text-xs text-muted-foreground">certificate templates</div>
        </Card>
      </div>
    </section>
  );
};
