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

import { type DescMessage, fromJson, type JsonValue, toJson } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";

import {
  AdoptNodeResponseSchema,
  ApprovalSchema,
  AuditEventSchema as FleetAuditEventSchema,
  McpKeySchema,
  OperatorCredentialRequestSchema,
  OperatorCredentialSchema,
} from "@cryptos-pki/api-client/cryptos/fleet/v1/fleet_pb";
import { OperatorCASchema } from "@cryptos-pki/api-client/cryptos/fleet/v1/operator_ca_pb";
import { AuditEventSchema } from "@cryptos-pki/api-client/cryptos/node/v1/audit_pb";
import { MachineConfigSchema } from "@cryptos-pki/api-client/cryptos/node/v1/config_pb";
import { NodeStatusSchema } from "@cryptos-pki/api-client/cryptos/node/v1/status_pb";

// Connect-Web decodes JSON responses with ignoreUnknownFields on, so a field the
// generated stubs do not know about is dropped without an error. A config read
// through the UI and applied back would then lose it on the node. Round-tripping
// the wire shape through the stubs the same way proves they carry every field.
const roundTrip = (schema: DescMessage, wire: JsonValue): JsonValue =>
  toJson(schema, fromJson(schema, wire, { ignoreUnknownFields: true }));

describe("generated stubs keep every field the node sends", () => {
  it("keeps the adoption ID and the presented fingerprint on an adoption message", () => {
    const wire = {
      adoptionId: "adopt-1",
      phase: "awaiting-fingerprint-confirmation",
      presentedCertSha256: "5f".repeat(32),
    };
    expect(roundTrip(AdoptNodeResponseSchema, wire)).toEqual(wire);
  });

  it("keeps network nameservers and search domains on a MachineConfig", () => {
    const wire = {
      apiVersion: "cryptos.dev/v1alpha1",
      kind: "MachineConfig",
      network: {
        address: "10.0.0.5/24",
        gateway: "10.0.0.1",
        interface: "eth0",
        nameservers: ["10.0.0.53", "10.0.1.53"],
        search: ["pki.example.org"],
      },
    };
    expect(roundTrip(MachineConfigSchema, wire)).toEqual(wire);
  });

  it("keeps otherName SANs, dotted-OID EKUs, request SANs and subject locality", () => {
    const wire = {
      pki: {
        profiles: [
          {
            allowRequestSans: true,
            extKeyUsage: ["serverAuth", "1.3.6.1.5.5.7.3.21"],
            name: "workstation",
            sans: { krb5Principal: ["host/ws01@EXAMPLE.ORG"], upn: ["ws01@example.org"] },
          },
        ],
        rootSubject: {
          commonName: "Example Root CA G1",
          locality: "Springfield",
          province: "Oregon",
        },
      },
    };
    expect(roundTrip(MachineConfigSchema, wire)).toEqual(wire);
  });

  it("keeps audit event details", () => {
    const wire = { details: { profile: "workstation", serial: "0a1b" } };
    expect(roundTrip(AuditEventSchema, wire)).toEqual(wire);
  });

  it("keeps the actor fields on a manager audit event", () => {
    const wire = {
      actorCn: "operator@example.org",
      actorKind: "mcp_key",
      actorSerial: "0A:BC:DE",
      at: "2026-09-01T00:00:00Z",
      id: "aud-1",
      keyId: "key-1",
      kind: "issued",
      outcome: "ok",
      requestDigest: "ab12",
      summary: "Issued leaf svc.example.org",
      tool: "cert_issue_from_csr",
      via: "mcp",
    };
    expect(roundTrip(FleetAuditEventSchema, wire)).toEqual(wire);
  });

  it("keeps every MCP key field", () => {
    const wire = {
      clientName: "Example Agent",
      createdAt: "2026-09-01T00:00:00Z",
      id: "key-1",
      label: "build agent",
      lastUsedAt: "2026-09-02T00:00:00Z",
      levelCeiling: "operator",
      operatorCn: "operator@example.org",
      operatorSerial: "0A:BC:DE",
      revokedAt: "2026-09-03T00:00:00Z",
    };
    expect(roundTrip(McpKeySchema, wire)).toEqual(wire);
  });

  it("keeps every approval field", () => {
    const wire = {
      createdAt: "2026-09-01T00:00:00Z",
      decidedAt: "2026-09-01T00:05:00Z",
      decidedByCn: "admin@example.org",
      decidedBySerial: "0D:EF",
      expiresAt: "2026-09-01T00:15:00Z",
      id: "ap-1",
      keyId: "key-1",
      requestDigest: "ab".repeat(32),
      requestedByCn: "operator@example.org",
      requestedBySerial: "0A:BC:DE",
      requiredLevel: "admin",
      status: "approved",
      summary: "Decommission node issuing-2",
      tool: "node_decommission",
    };
    expect(roundTrip(ApprovalSchema, wire)).toEqual(wire);
  });

  it("keeps the revocation preflight and resolver status", () => {
    const wire = {
      resolver: {
        nameservers: ["10.0.0.53"],
        search: ["pki.example.org"],
        source: "RESOLVER_SOURCE_MACHINE_CONFIG",
      },
      revocationPreflight: {
        baseUrl: "http://pki.example.org/crl",
        state: "REVOCATION_PREFLIGHT_STATE_OK",
      },
    };
    expect(roundTrip(NodeStatusSchema, wire)).toEqual(wire);
  });

  it("keeps every operator credential field", () => {
    const wire = {
      commonName: "alice@example.org",
      crlRevoked: true,
      denylisted: true,
      email: "alice@example.org",
      firstSeenAt: "2026-09-01T00:00:00Z",
      fullName: "Alice Example",
      issuerSha256: "ab".repeat(32),
      kind: "observed",
      lastSeenAt: "2026-09-02T00:00:00Z",
      level: "operator",
      notAfter: "2027-09-01T00:00:00Z",
      revoked: true,
      serialHex: "0A:0B",
    };
    expect(roundTrip(OperatorCredentialSchema, wire)).toEqual(wire);
  });

  it("keeps every credential request field", () => {
    const wire = {
      completedSerial: "0A",
      createdAt: "2026-09-01T00:00:00Z",
      createdByCn: "admin@example.org",
      csrPem: "-----BEGIN CERTIFICATE REQUEST-----",
      email: "bob@example.org",
      expiresAt: "2026-10-01T00:00:00Z",
      fullName: "Bob Example",
      id: "req-1",
      level: "viewer",
      state: "completed",
    };
    expect(roundTrip(OperatorCredentialRequestSchema, wire)).toEqual(wire);
  });

  it("keeps every operator CA field", () => {
    const wire = {
      acknowledgements: ["OPERATOR_CA_ACKNOWLEDGEMENT_NO_CRL"],
      crl: {
        crlNumber: "4096",
        fetchedAt: "2026-09-01T00:00:00Z",
        lastError: "timeout",
        nextUpdate: "2026-09-08T00:00:00Z",
        revokedCount: "3",
        stale: true,
        thisUpdate: "2026-09-01T00:00:00Z",
      },
      crlLocation: "http://pki.example.org/operator.crl",
      crlSource: "CRL_SOURCE_URL",
      issuer: "CN=Example Operator CA",
      managedByConfig: true,
      notAfter: "2036-09-01T00:00:00Z",
      ocspLastError: "unreachable",
      ocspMode: "OCSP_MODE_URL",
      ocspUrl: "http://ocsp.example.org/",
      registeredAt: "2026-09-01T00:00:00Z",
      retiredAt: "2026-09-10T00:00:00Z",
      retiredReason: "retired",
      sha256: "cd".repeat(32),
      state: "OPERATOR_CA_STATE_RETIRED",
      subject: "CN=Example Operator CA",
      warnings: ["issued by a fleet node's CA"],
    };
    expect(roundTrip(OperatorCASchema, wire)).toEqual(wire);
  });
});
