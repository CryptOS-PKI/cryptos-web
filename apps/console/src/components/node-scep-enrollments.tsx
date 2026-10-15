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

import {
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconEnrollment,
} from "@cryptos-pki/ui";
import { useEffect, useState } from "react";

import { ApproveNodeScepEnrollmentDialog } from "@/components/approve-node-scep-enrollment-dialog";
import { RejectNodeScepEnrollmentDialog } from "@/components/reject-node-scep-enrollment-dialog";
import { useOptionalAuth } from "@/context/auth";
import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { listNodeScepEnrollments, type NodeScepEnrollment } from "@/lib/node-scep-enrollments";

const sans = (e: NodeScepEnrollment): string => [...e.dnsNames, ...e.ipAddresses].join(", ") || "—";

// NodeScepEnrollments lists a managed node's pending SCEP device enrolments
// (proxying the node's own queue) and lets an operator approve or reject
// one. Both decisions need operator level or above, the node's own write
// paths; viewers see the list only.
export const NodeScepEnrollments = ({ nodeName }: { nodeName: string }) => {
  const isOperator = useOptionalAuth()?.operator?.level !== "viewer";
  const [enrollments, setEnrollments] = useState<NodeScepEnrollment[]>([]);
  const [status, setStatus] = useState<"error" | "loading" | "ready">("loading");
  const [loadError, setLoadError] = useState("");
  const [approveTarget, setApproveTarget] = useState<NodeScepEnrollment | null>(null);
  const [rejectTarget, setRejectTarget] = useState<NodeScepEnrollment | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    listNodeScepEnrollments(nodeName)
      .then((result) => {
        if (cancelled) return;
        setEnrollments(result);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(fleetErrorMessage(error, "Failed to load the node's SCEP enrolment queue"));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [nodeName, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const columns: DataTableColumn<NodeScepEnrollment>[] = [
    { cell: (e) => e.subjectDn, header: "Subject", id: "subjectDn" },
    { cell: (e) => e.profile, header: "Profile", id: "profile" },
    { cell: sans, header: "SANs", id: "sans" },
    { cell: (e) => e.keyAlg, header: "Key", id: "keyAlg" },
    {
      cell: (e) => e.receivedAt.slice(0, 16).replace("T", " "),
      header: "Received",
      id: "receivedAt",
    },
    {
      cell: (e) =>
        isOperator ? (
          <div className="flex gap-2">
            <Button onClick={() => setApproveTarget(e)} size="sm">
              Approve
            </Button>
            <Button onClick={() => setRejectTarget(e)} size="sm" variant="outline">
              Reject
            </Button>
          </div>
        ) : null,
      header: <span className="sr-only">Actions</span>,
      id: "actions",
      mobile: "action",
    },
  ];

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        empty={
          <EmptyState
            body="No pending SCEP enrolments."
            icon={IconEnrollment}
            title="Queue is empty"
          />
        }
        error={
          <EmptyState
            body={loadError}
            icon={IconEnrollment}
            title="Couldn't load the SCEP enrolment queue"
            tone="danger"
          />
        }
        label="SCEP enrolment queue"
        rowKey={(e) => e.id}
        rows={enrollments}
        status={status}
      />

      {approveTarget ? (
        <ApproveNodeScepEnrollmentDialog
          enrollmentId={approveTarget.id}
          nodeName={nodeName}
          onClose={() => setApproveTarget(null)}
          onDone={() => {
            refresh();
          }}
          profile={approveTarget.profile}
          subjectDn={approveTarget.subjectDn}
        />
      ) : null}
      {rejectTarget ? (
        <RejectNodeScepEnrollmentDialog
          enrollmentId={rejectTarget.id}
          nodeName={nodeName}
          onClose={() => setRejectTarget(null)}
          onDone={() => {
            setRejectTarget(null);
            refresh();
          }}
          subjectDn={rejectTarget.subjectDn}
        />
      ) : null}
    </div>
  );
};
