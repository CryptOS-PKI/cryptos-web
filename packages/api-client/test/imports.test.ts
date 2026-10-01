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

import { FleetService, NodeSummarySchema } from "@cryptos-pki/api-client/cryptos/fleet/v1/fleet_pb";
import { MachineConfigSchema } from "@cryptos-pki/api-client/cryptos/node/v1/config_pb";
import { describe, expect, it } from "vitest";

describe("@cryptos-pki/api-client", () => {
  it("exports the node API from cryptos.node.v1", () => {
    expect(MachineConfigSchema.typeName).toBe("cryptos.node.v1.MachineConfig");
  });

  it("exports the fleet API from cryptos.fleet.v1", () => {
    expect(NodeSummarySchema.typeName).toBe("cryptos.fleet.v1.NodeSummary");
    expect(FleetService.typeName).toBe("cryptos.fleet.v1.FleetService");
  });

  it("resolves the node types the fleet API embeds", () => {
    const field = NodeSummarySchema.fields.find((f) => f.name === "protocols");
    expect(field?.message?.typeName).toBe("cryptos.node.v1.ProtocolStatus");
  });
});
