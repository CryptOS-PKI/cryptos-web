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

import type { ColumnDef } from "@tanstack/react-table";

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { DataTable } from "@/components/data-table/data-table";
import { RevokeDialog } from "@/components/revoke-dialog";
import { type Cert, type CertStatus, useCerts } from "@/lib/certs";

const STATUS_TONE: Record<CertStatus, string> = {
  EXPIRED: "text-muted-foreground",
  REVOKED: "text-destructive",
  VALID: "text-success",
};

const makeColumns = (
  nodeName: string,
  onRevoke: (c: { serial: string; subjectCn: string }) => void,
): ColumnDef<Cert, unknown>[] => [
  {
    accessorKey: "serial",
    cell: ({ row }) => (
      <Link
        className="text-primary hover:underline"
        to={`/nodes/${nodeName}/certs/${row.original.serial}`}
      >
        {row.original.serial}
      </Link>
    ),
    header: "Serial",
  },
  { accessorKey: "subjectCn", header: "Subject CN" },
  {
    accessorKey: "kind",
    cell: ({ row }) => (row.original.kind === "subordinate-ca" ? "sub-CA" : "leaf"),
    header: "Kind",
  },
  {
    accessorFn: (c) => c.notAfter.slice(0, 10),
    enableSorting: false,
    header: "Expires",
    id: "expires",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <span className={STATUS_TONE[row.original.status]}>{row.original.status}</span>
    ),
    header: "Status",
  },
  {
    cell: ({ row }) =>
      row.original.status === "REVOKED" ? null : (
        <button
          className="text-destructive hover:underline"
          onClick={() =>
            onRevoke({ serial: row.original.serial, subjectCn: row.original.subjectCn })
          }
          type="button"
        >
          Revoke
        </button>
      ),
    enableSorting: false,
    header: "",
    id: "actions",
  },
];

export const CertInventory = ({ nodeName }: { nodeName: string }) => {
  const certs = useCerts(nodeName);
  const [revoking, setRevoking] = useState<{ serial: string; subjectCn: string } | null>(null);

  const columns = useMemo(() => makeColumns(nodeName, setRevoking), [nodeName]);

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        data={certs}
        facets={[{ columnId: "status", title: "Status" }]}
        initialSort={[{ desc: false, id: "expires" }]}
        searchKeys={["subjectCn", "serial"]}
      />
      {revoking ? (
        <RevokeDialog
          onClose={() => setRevoking(null)}
          serial={revoking.serial}
          subjectCn={revoking.subjectCn}
        />
      ) : null}
    </div>
  );
};
