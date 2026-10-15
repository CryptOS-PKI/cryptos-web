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
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconCertificates,
  StatusBadge,
} from "@cryptos-pki/ui";
import { useEffect, useState } from "react";

import { fleetErrorMessage } from "@/lib/fleet/error-copy";
import { listNodeTsaCertificates, type NodeTsaCertificate } from "@/lib/node-tsa";

// NodeTsaCertificates lists a managed node's time-stamp authority
// certificates. The node returns an empty list while its TSA is not running,
// so the empty state says that rather than "no results".
export const NodeTsaCertificates = ({ nodeName }: { nodeName: string }) => {
  const [certificates, setCertificates] = useState<NodeTsaCertificate[]>([]);
  const [status, setStatus] = useState<"error" | "loading" | "ready">("loading");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    listNodeTsaCertificates(nodeName)
      .then((result) => {
        if (cancelled) return;
        setCertificates(result);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(fleetErrorMessage(error, "Failed to load the node's TSA certificates"));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [nodeName]);

  const columns: DataTableColumn<NodeTsaCertificate>[] = [
    {
      cell: (c) =>
        c.current ? (
          <StatusBadge status="active">Current</StatusBadge>
        ) : (
          <StatusBadge status="muted">Past</StatusBadge>
        ),
      header: "Status",
      id: "current",
    },
    { cell: (c) => c.serialHex, header: "Serial", id: "serialHex" },
    { cell: (c) => c.sha256Hex, header: "SHA-256", id: "sha256Hex" },
    { cell: (c) => c.notBefore.slice(0, 10), header: "Not before", id: "notBefore" },
    { cell: (c) => c.notAfter.slice(0, 10), header: "Not after", id: "notAfter" },
  ];

  return (
    <DataTable
      columns={columns}
      empty={
        <EmptyState
          body="This node's time-stamp authority is not running."
          icon={IconCertificates}
          title="No TSA certificates"
        />
      }
      error={
        <EmptyState
          body={loadError}
          icon={IconCertificates}
          title="Couldn't load the TSA certificates"
          tone="danger"
        />
      }
      label="TSA certificates"
      rowKey={(c) => c.serialHex}
      rows={certificates}
      status={status}
    />
  );
};
